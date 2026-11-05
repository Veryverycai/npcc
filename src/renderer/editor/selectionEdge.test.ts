import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { caretLineInSelection } from './selectionEdge';

function stateOf(doc: string, anchor: number, head: number): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
}

describe('caretLineInSelection', () => {
  it('tints the empty last line after select-all on a trailing newline', () => {
    const doc = 'alpha beta\n';
    // Select all: the caret sits at the start of the empty second line.
    expect(caretLineInSelection(stateOf(doc, 0, doc.length))).toBe(11);
  });

  it('stays quiet when the caret line holds selected text', () => {
    expect(caretLineInSelection(stateOf('alpha beta\ngamma\n', 0, 4))).toBeNull();
  });

  it('stays quiet without a selection', () => {
    expect(caretLineInSelection(stateOf('alpha\n', 3, 3))).toBeNull();
  });

  it('works for backwards selections too', () => {
    const doc = 'one\ntwo\n';
    // The empty line the selection reaches sits at the other end now.
    expect(caretLineInSelection(stateOf(doc, doc.length, 0))).toBe(8);
  });

  it('never tints the line a selection selects the text of', () => {
    // Dragging from gamma up to column one of the padded first line: that line
    // shows its own selected characters, and filling the row would make the
    // padding behind "alpha" look selected as well.
    const doc = 'alpha    \nbeta\ngamma\n';
    expect(caretLineInSelection(stateOf(doc, 15, 0))).toBeNull();
  });

  it('leaves the last line alone when a selection stops there', () => {
    // Dragging down past the end of the file ends on the empty last line;
    // filling that row would look like the whole line got selected.
    expect(caretLineInSelection(stateOf('alpha\nbeta\n', 6, 11))).toBeNull();
  });
});
