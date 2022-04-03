import { Editor } from "../editor/editor";
import { Selection } from "../editor/selection";
import * as t from "../ast";
import { Color, COLORS } from "../editor";

export async function toggleHighlight(editor: Editor): Promise<void> {
  const { code, selection } = editor;

  const references: Selection[] = [];
  t.parseAndTraverseCode(code, {
    Identifier(path) {
      if (!selection.isInsidePath(path)) return;
      if (!t.isSelectablePath(path)) return;

      references.push(Selection.fromAST(path.node.loc));
      references.push(
        ...t
          .selectableReferencesInScope(path)
          .map(({ node }) => Selection.fromAST(node.loc))
      );
    }
  });

  const color = COLORS[editor.nextHighlightColorIndex % COLORS.length];
  editor.highlight(color, references);
  editor.nextHighlightColorIndex += 1;
}
