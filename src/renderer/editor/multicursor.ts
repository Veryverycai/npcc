import { EditorSelection, type SelectionRange } from '@codemirror/state';
import { EditorView, keymap, type Command } from '@codemirror/view';

/** Caps the number of cursors so a common token cannot freeze the view. */
export const MAX_MATCHES = 5000;

/** Returns the [from, to] offsets of every occurrence of `query` in `text`. */
export function findMatches(
  text: string,
  query: string,
  limit = MAX_MATCHES,
): Array<[number, number]> {
  const matches: Array<[number, number]> = [];
  if (query.length === 0) return matches;
  let at = text.indexOf(query);
  while (at !== -1 && matches.length < limit) {
    matches.push([at, at + query.length]);
    at = text.indexOf(query, at + query.length);
  }
  return matches;
}

/**
 * Adds a cursor on the line above/below while keeping the same visual column.
 * Combined with the built-in Ctrl+click (CM adds a range when `event.ctrlKey` is
 * set on Windows) and rectangular selection this covers the multi-cursor
 * workflows Notepad++ users expect.
 */
function addCursor(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const ranges = state.selection.ranges;
  const edge = direction > 0 ? ranges[ranges.length - 1] : ranges[0];
  const line = state.doc.lineAt(edge.head);
  const goalColumn = edge.head - line.from;
  const targetNumber = line.number + direction;
  if (targetNumber < 1 || targetNumber > state.doc.lines) return false;
  const target = state.doc.line(targetNumber);
  const anchor = Math.min(target.from + goalColumn, target.to);
  const selection = EditorSelection.create(
    [...ranges, EditorSelection.cursor(anchor)],
    ranges.length,
  );
  view.dispatch({ selection, scrollIntoView: true });
  return true;
}

const addCursorAbove: Command = (view) => addCursor(view, -1);
const addCursorBelow: Command = (view) => addCursor(view, 1);

/**
 * Selects every occurrence of the current selection (or of the word under the
 * cursor) and turns each into its own cursor, like "select all occurrences".
 */
export const selectAllMatches: Command = (view) => {
  const { state } = view;
  const main = state.selection.main;
  let query = state.sliceDoc(main.from, main.to);
  if (query.length === 0) {
    const word = state.wordAt(main.head);
    if (!word) return false;
    query = state.sliceDoc(word.from, word.to);
  }
  if (query.length === 0) return false;

  const text = state.sliceDoc(0);
  const ranges: SelectionRange[] = findMatches(text, query).map(([from, to]) =>
    EditorSelection.range(from, to),
  );
  if (ranges.length === 0) return false;

  view.dispatch({ selection: EditorSelection.create(ranges, 0), scrollIntoView: true });
  return true;
};

const multiCursorKeymap = keymap.of([
  { key: 'Alt-Shift-ArrowUp', run: addCursorAbove, preventDefault: true },
  { key: 'Alt-Shift-ArrowDown', run: addCursorBelow, preventDefault: true },
  { key: 'Ctrl-Shift-l', run: selectAllMatches, preventDefault: true },
]);

export function multiCursorExtension() {
  return multiCursorKeymap;
}
