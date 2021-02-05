import { Code, Editor, Modification } from "../../../editor/editor";
import { Selection } from "../../../editor/selection";
import { Position } from "../../../editor/position";
import * as t from "../../../ast";

import {
  Variable,
  StringLiteralVariable,
  MemberExpressionVariable,
  ShorthandVariable
} from "./variable";
import { Parts } from "./parts";
import { DestructureStrategy } from "./destructure-strategy";
import {
  DeclarationOnCommonAncestor,
  MergeDestructuredDeclaration,
  VariableDeclarationModification
} from "./variable-declaration-modification";
import { last } from "../../../array";

export { createOccurrence, Occurrence };

function createOccurrence(
  path: t.NodePath,
  loc: t.SourceLocation,
  selection: Selection
): Occurrence {
  if (t.canBeShorthand(path)) {
    const variable = new ShorthandVariable(path);

    if (variable.isValid) {
      return new ShorthandOccurrence(path, loc, variable);
    }
  }

  if (path.isMemberExpression() && !path.node.computed) {
    return new MemberExpressionOccurrence(
      path,
      loc,
      new MemberExpressionVariable(path)
    );
  }

  if (path.isStringLiteral()) {
    if (!selection.isEmpty() && selection.isStrictlyInsidePath(path)) {
      path.replaceWith(t.convertStringToTemplateLiteral(path.node, loc));
      return createOccurrence(path, loc, selection);
    }

    return new Occurrence(
      path,
      loc,
      new StringLiteralVariable(path, path.node.value)
    );
  }

  if (
    path.isTemplateLiteral() &&
    !selection.isEmpty() &&
    PartialTemplateLiteralOccurrence.isValid(path, loc, selection)
  ) {
    return new PartialTemplateLiteralOccurrence(path, loc, selection);
  }

  return new Occurrence(path, loc, new Variable(path));
}

class Occurrence<T extends t.Node = t.Node> {
  constructor(
    public path: t.NodePath<T>,
    public loc: t.SourceLocation,
    protected variable: Variable
  ) {}

  get selection() {
    return Selection.fromAST(this.loc);
  }

  get modification(): Modification {
    return {
      code: this.variable.id,
      selection: this.selection
    };
  }

  get positionOnExtractedId(): Position {
    return new Position(
      this.selection.start.line + this.selection.height + 1,
      this.selection.start.character + this.variable.length
    );
  }

  get parentScopePosition(): Position {
    const parentPath = t.findScopePath(this.path);
    const parent = parentPath ? parentPath.node : this.path.node;
    if (!parent.loc) return this.selection.start;

    return Position.fromAST(parent.loc.start);
  }

  toVariableDeclaration(
    extractedCode: Code,
    allOccurrences: Occurrence[]
  ): Modification {
    const { name, value } = this.variableDeclarationParts(extractedCode);
    const useTabs = t.isUsingTabs(this.path.node);

    if (allOccurrences.length > 1) {
      return new DeclarationOnCommonAncestor(
        name,
        value,
        useTabs,
        allOccurrences
      );
    }

    return new VariableDeclarationModification(
      name,
      value,
      useTabs,
      Selection.cursorAtPosition(this.parentScopePosition)
    );
  }

  protected variableDeclarationParts(code: Code): { name: Code; value: Code } {
    return {
      name: this.variable.name,
      value: t.isJSXText(this.path.node) ? `"${code}"` : code
    };
  }

  askModificationDetails(_editor: Editor): Promise<void> {
    return Promise.resolve();
  }
}

class ShorthandOccurrence extends Occurrence<t.ObjectProperty> {
  private get keySelection(): Selection {
    return Selection.fromAST(this.path.node.key.loc);
  }

  get modification(): Modification {
    return {
      code: "",
      selection: this.selection.extendStartToEndOf(this.keySelection)
    };
  }

  get positionOnExtractedId(): Position {
    return new Position(
      this.selection.start.line + this.selection.height + 1,
      this.keySelection.end.character
    );
  }
}

class MemberExpressionOccurrence extends Occurrence<t.MemberExpression> {
  private destructureStrategy = DestructureStrategy.Destructure;

  toVariableDeclaration(
    extractedCode: Code,
    allOccurrences: Occurrence[]
  ): Modification {
    if (this.destructureStrategy === DestructureStrategy.Preserve) {
      return super.toVariableDeclaration(extractedCode, allOccurrences);
    }

    const existingDeclaration = t.findFirstExistingDeclaration(
      this.path.get("object")
    );

    if (existingDeclaration) {
      const lastProperty = last(existingDeclaration.node.id.properties);
      if (lastProperty && t.isSelectableNode(lastProperty)) {
        return new MergeDestructuredDeclaration(
          this.variable.name,
          lastProperty
        );
      }
    }

    const name = `{ ${this.variable.name} }`;
    const value = this.parentObject;
    const useTabs = t.isUsingTabs(this.path.node);

    if (allOccurrences.length > 1) {
      return new DeclarationOnCommonAncestor(
        name,
        value,
        useTabs,
        allOccurrences
      );
    }

    return new VariableDeclarationModification(
      name,
      value,
      useTabs,
      Selection.cursorAtPosition(this.parentScopePosition)
    );
  }

  async askModificationDetails(editor: Editor) {
    const choice = await editor.askUserChoice([
      {
        label: `Destructure => \`const { ${this.variable.name} } = ${this.parentObject}\``,
        value: DestructureStrategy.Destructure
      },
      {
        label: `Preserve => \`const ${this.variable.name} = ${this.parentObject}.${this.variable.name}\``,
        value: DestructureStrategy.Preserve
      }
    ]);

    if (choice) {
      this.destructureStrategy = choice.value;
    }
  }

  private get parentObject(): Code {
    return t.generate(this.path.node.object);
  }
}

class PartialTemplateLiteralOccurrence extends Occurrence<t.TemplateLiteral> {
  constructor(
    path: t.NodePath<t.TemplateLiteral>,
    loc: t.SourceLocation,
    private readonly userSelection: Selection
  ) {
    super(path, loc, new Variable(path));

    // Override variable after `this` is set
    this.variable = new StringLiteralVariable(path, this.parts.selected);
  }

  static isValid(
    path: t.NodePath<t.TemplateLiteral>,
    loc: t.SourceLocation,
    userSelection: Selection
  ): boolean {
    // This doesn't work yet for multi-lines code because we don't support it.
    if (Selection.fromAST(loc).isMultiLines) return false;

    try {
      const occurrence = new PartialTemplateLiteralOccurrence(
        path,
        loc,
        userSelection
      );

      // If any of these throws, Occurrence is invalid
      occurrence.variableDeclarationParts();
      occurrence.modification;
    } catch {
      return false;
    }

    return true;
  }

  protected variableDeclarationParts(): { name: Code; value: Code } {
    return {
      name: this.variable.name,
      value: `"${this.parts.selected}"`
    };
  }

  get modification(): Modification {
    const { before, after } = this.parts;
    const { quasis, expressions } = this.path.node;
    const { index } = this.selectedQuasi;

    const newQuasis = [t.templateElement(before), t.templateElement(after)];

    const newTemplateLiteral = t.templateLiteral(
      // Replace quasi with the new truncated ones
      [...quasis.slice(0, index), ...newQuasis, ...quasis.slice(index + 1)],
      // Insert the new expression
      [
        ...expressions.slice(0, index),
        t.identifier(this.variable.name),
        ...expressions.slice(index)
      ]
    );

    return {
      code: t.print(newTemplateLiteral),
      selection: this.selection
    };
  }

  private get parts(): Parts {
    const offset = Selection.fromAST(this.selectedQuasi.loc).start;
    return new Parts(this.selectedQuasi.value.raw, this.userSelection, offset);
  }

  private get selectedQuasi(): t.TemplateElement &
    t.SelectableNode & { index: number } {
    const index = this.path.node.quasis.findIndex((quasi) =>
      this.userSelection.isInsideNode(quasi)
    );

    if (index < 0) {
      throw new Error("I can't find selected text in template elements");
    }

    const result = this.path.node.quasis[index];

    if (!t.isSelectableNode(result)) {
      throw new Error("Template element is not selectable");
    }

    return { ...result, index };
  }

  get positionOnExtractedId(): Position {
    // ${ is inserted before the Identifier
    const openingInterpolationLength = 2;

    return new Position(
      this.selection.start.line + this.selection.height + 1,
      this.userSelection.start.character + openingInterpolationLength
    );
  }
}
