import { EditorSelection, type EditorState, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

export interface LineRange {
  from: number;
  to: number;
}

/**
 * CodeMirror's triple click selects `line.from .. line.to` (plus the line break),
 * so any line padded with spaces -- alignment padding, or a file that keeps a
 * tail of blanks -- highlights the whole right-hand side and copies it back out.
 * The line's text is what people mean by "this line", so the padding is dropped.
 *
 * A line with no text at all selects its line break instead, which keeps a triple
 * click usable for cutting an empty line away.
 */
export function lineSelectRange(state: EditorState, pos: number): LineRange {
  const line = state.doc.lineAt(pos);
  const text = line.text.replace(/\s+$/, '');
  if (text.length > 0) return { from: line.from, to: line.from + text.length };
  if (line.to < state.doc.length) return { from: line.to, to: line.to + 1 };
  return { from: line.to, to: line.to };
}

/**
 * Triple click selects the line's text rather than the padding behind it.
 * The listener sits on `view.dom` in the capture phase so it runs before the
 * editor's own mousedown handling and can replace its line range.
 */
export function lineSelect(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly onDown = (event: MouseEvent): void => {
        if (event.button !== 0 || event.detail < 3) return;
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        const { view } = this;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return;
        const { from, to } = lineSelectRange(view.state, pos);
        // Keep the browser and the editor from collapsing the range we pick.
        event.preventDefault();
        event.stopPropagation();
        view.dispatch({
          selection: EditorSelection.range(from, to),
          userEvent: 'select.pointer',
        });
        view.focus();
      };

      constructor(readonly view: EditorView) {
        view.dom.addEventListener('mousedown', this.onDown, true);
      }

      destroy(): void {
        this.view.dom.removeEventListener('mousedown', this.onDown, true);
      }
    },
  );
}
