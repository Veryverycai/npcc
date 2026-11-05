import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { lineSelectRange } from './lineSelect';

function rangeFor(doc: string, pos: number): { text: string; from: number; to: number } {
  const state = EditorState.create({ doc });
  const range = lineSelectRange(state, pos);
  return { text: state.doc.sliceString(range.from, range.to), ...range };
}

describe('lineSelectRange', () => {
  it('drops the trailing spaces a padded line carries', () => {
    expect(rangeFor('alpha    \nbeta', 1)).toEqual({ text: 'alpha', from: 0, to: 5 });
  });

  it('drops the line break as well, so a copy stays one line', () => {
    expect(rangeFor('alpha    \nbeta', 1).text).not.toContain('\n');
  });

  it('keeps a line without padding whole', () => {
    expect(rangeFor('alpha\nbeta\n', 8)).toEqual({ text: 'beta', from: 6, to: 10 });
  });

  it('selects only the break of an empty or blank line', () => {
    // Line 2 of "a\n   \nb" holds three spaces; cutting it away is the next
    // thing a user does after selecting it.
    expect(rangeFor('a\n   \nb', 3)).toEqual({ text: '\n', from: 5, to: 6 });
    expect(rangeFor('a\n\nb', 2)).toEqual({ text: '\n', from: 2, to: 3 });
  });

  it('leaves the caret at the end when the blank line has no break', () => {
    expect(rangeFor('a\n   ', 3)).toEqual({ text: '', from: 5, to: 5 });
  });

  it('works on the last line without a trailing newline', () => {
    expect(rangeFor('alpha    ', 7)).toEqual({ text: 'alpha', from: 0, to: 5 });
  });
});
