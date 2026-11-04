import { EditorView } from '@codemirror/view';

import { getActiveView } from './stateRegistry';

/** Moves the cursor to a 1-based line/column and centres it in the viewport. */
export function gotoLine(lineNumber: number, column = 1): boolean {
  const view = getActiveView();
  if (!view) return false;
  return gotoLineInView(view, lineNumber, column);
}

export function gotoLineInView(view: EditorView, lineNumber: number, column = 1): boolean {
  const { doc } = view.state;
  const clampedLine = Math.min(Math.max(1, lineNumber), doc.lines);
  const info = doc.line(clampedLine);
  const position = Math.min(info.from + Math.max(0, column - 1), info.to);
  view.dispatch({
    selection: { anchor: position },
    effects: EditorView.scrollIntoView(position, { y: 'center' }),
  });
  view.focus();
  return true;
}

/**
 * Selects `length` characters at a 1-based line/column, so a jump to a search
 * hit highlights the matched text itself instead of leaving a bare caret.
 */
export function selectRangeAt(lineNumber: number, column = 1, length = 0): boolean {
  const view = getActiveView();
  if (!view) return false;
  return selectRangeInView(view, lineNumber, column, length);
}

export function selectRangeInView(
  view: EditorView,
  lineNumber: number,
  column = 1,
  length = 0,
): boolean {
  const { doc } = view.state;
  const clampedLine = Math.min(Math.max(1, lineNumber), doc.lines);
  const info = doc.line(clampedLine);
  const from = Math.min(info.from + Math.max(0, column - 1), info.to);
  const to = Math.min(from + Math.max(0, length), info.to);
  view.dispatch({
    selection: { anchor: from, head: to },
    effects: EditorView.scrollIntoView(from, { y: 'center' }),
  });
  view.focus();
  return true;
}
