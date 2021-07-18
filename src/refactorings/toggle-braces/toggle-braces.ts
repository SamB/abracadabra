import { Editor, ErrorReason } from "../../editor/editor";
import { Selection } from "../../editor/selection";
import * as t from "../../ast";
import { Position } from "../../editor/position";

export { toggleBraces, createVisitor };

async function toggleBraces(editor: Editor) {
  const { code, selection } = editor;
  const updatedCode = updateCode(t.parse(code), selection);

  if (!updatedCode.hasCodeChanged) {
    editor.showError(ErrorReason.DidNotFindStatementToToggleBraces);
    return;
  }

  await editor.write(updatedCode.code);
}

function updateCode(ast: t.AST, selection: Selection): t.Transformed {
  return t.transformAST(
    ast,
    createVisitor(selection, (path) => {
      if (t.isIfStatement(path.node)) {
        if (!t.isSelectableNode(path.node.consequent)) return;
        const endOfConsequent = Position.fromAST(path.node.consequent.loc.end);

        if (selection.start.isBefore(endOfConsequent)) {
          path.node.consequent = statementWithBraces(path.node.consequent);
          return;
        }

        if (path.node.alternate) {
          path.node.alternate = statementWithBraces(path.node.alternate);
        }

        path.stop();
      } else {
        // Wrap the string literal in a JSX Expression
        if (path.node.value && !t.isJSXExpressionContainer(path.node.value)) {
          path.node.value = t.jsxExpressionContainer(path.node.value);
        }
        path.stop();
      }
    })
  );
}

function statementWithBraces(node: t.Statement): t.Statement {
  return t.isBlockStatement(node) ? node : t.blockStatement([node]);
}

function createVisitor(
  selection: Selection,
  onMatch: (path: t.NodePath<t.IfStatement | t.JSXAttribute>) => void
): t.Visitor {
  return {
    IfStatement(path) {
      if (!selection.isInsidePath(path)) return;
      if (hasBracesAlready(path)) return;

      // Since we visit nodes from parent to children, first check
      // if a child would match the selection closer.
      if (hasChildWhichMatchesSelection(path, selection)) return;

      onMatch(path);
    },
    JSXAttribute(path) {
      if (!selection.isInsidePath(path)) return;

      // SMELL: could a child match here?

      if (t.isStringLiteral(path.node.value)) {
        onMatch(path);
      }
    }
  };
}

function hasBracesAlready(path: t.NodePath<t.IfStatement>): boolean {
  const { consequent, alternate } = path.node;

  return (
    t.isBlockStatement(consequent) &&
    (alternate === null || t.isBlockStatement(alternate))
  );
}

function hasChildWhichMatchesSelection(
  path: t.NodePath,
  selection: Selection
): boolean {
  let result = false;

  path.traverse({
    IfStatement(childPath) {
      if (!selection.isInsidePath(childPath)) return;

      result = true;
      childPath.stop();
    }
  });

  return result;
}
