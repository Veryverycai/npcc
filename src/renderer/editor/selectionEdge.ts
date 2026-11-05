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
 * The browser only paints the characters a selection covers, so Ctrl+A on a file
 * that ends with a newline leaves the last, empty line looking untouched. That
 * one case is what the tint is for, and the row is filled in by hand only when
 * the whole document is selected.
 *
 * Filling any other row was wrong: a line decoration paints the full width, so
 * a selection reaching the start of a line -- which is where a selection made
 * upwards always ends -- made that line look as if the padding behind its text
 * had been selected too, and reaching the empty last line did the same.
 */
export function caretLineInSelection(state: EditorState): number | null {
  const range = state.selection.main;
  if (range.from !== 0 || range.to !== state.doc.length) return null;
  const line = state.doc.lineAt(range.to);
  return line.length === 0 ? line.from : null;
}

function decorationsFor(state: EditorState): DecorationSet {
  const position = caretLineInSelection(state);
  return position == null ? Decoration.none : RangeSet.of([caretLine.range(position)]);
}

/** Fills in the empty last line a select-all reaches, so it does not look untouched. */
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
