import { RangeSet, type EditorState, type Extension } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';

const caretLine = Decoration.line({ class: 'cm-caret-line-selected' });

/**
 * The browser only paints the characters a selection covers, so the line that
 * carries the caret stays unhighlighted whenever the selection stops at its
 * very start — Ctrl+A on a file ending with a newline left the last, empty line
 * looking unselected. Returns that line's start, or null when the caret line is
 * already covered by selected text.
 */
export function caretLineInSelection(state: EditorState): number | null {
  const range = state.selection.main;
  if (range.empty) return null;
  const line = state.doc.lineAt(range.head);
  return range.head === line.from ? line.from : null;
}

function decorationsFor(state: EditorState): DecorationSet {
  const position = caretLineInSelection(state);
  return position == null ? Decoration.none : RangeSet.of([caretLine.range(position)]);
}

/** Tints the caret line while a selection reaches into it from above. */
export function selectionEdge(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorationsFor(view.state);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
          this.decorations = decorationsFor(update.state);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
