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
 * The browser only paints the characters a selection covers, so an empty line
 * that the selection reaches stays untouched: Ctrl+A on a file ending with a
 * newline left the last, empty line looking unselected.
 *
 * A line that holds text needs no help -- its characters are painted anyway --
 * and tinting it painted the whole row past the last character. Selecting
 * upward ends on column one of the line above, so that row showed a band all
 * the way across, as if the padding behind the text had been selected too.
 * Only an empty line at either end of the selection gets the tint.
 */
export function caretLineInSelection(state: EditorState): number | null {
  const range = state.selection.main;
  if (range.empty) return null;
  return emptyLineAt(state, range.from) ?? emptyLineAt(state, range.to);
}

function emptyLineAt(state: EditorState, pos: number): number | null {
  const line = state.doc.lineAt(pos);
  return line.length === 0 ? line.from : null;
}

function decorationsFor(state: EditorState): DecorationSet {
  const position = caretLineInSelection(state);
  return position == null ? Decoration.none : RangeSet.of([caretLine.range(position)]);
}

/** Tints an empty line that a selection reaches, so it does not look untouched. */
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
