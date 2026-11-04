import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { secondaryPaint } from './multiRangePaint';

function painted(state: EditorState): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  secondaryPaint(state).between(0, state.doc.length, (from, to) => {
    spans.push([from, to]);
  });
  return spans;
}

/** The editor enables multi-selection itself, so the fixtures must too. */
const MULTI = EditorState.allowMultipleSelections.of(true);

describe('secondaryPaint', () => {
  it('paints nothing for a single cursor', () => {
    const state = EditorState.create({
      doc: 'alpha',
      selection: EditorSelection.cursor(2),
      extensions: MULTI,
    });
    expect(painted(state)).toEqual([]);
  });

  it('paints the non-main ranges only', () => {
    const state = EditorState.create({
      doc: 'alpha beta alpha',
      selection: EditorSelection.create([
        EditorSelection.range(0, 5),
        EditorSelection.range(11, 16),
      ]),
      extensions: MULTI,
    });
    expect(painted(state)).toEqual([[11, 16]]);
  });

  it('paints a caret for extra cursors', () => {
    const state = EditorState.create({
      doc: 'one\ntwo',
      selection: EditorSelection.create(
        [EditorSelection.cursor(0), EditorSelection.cursor(5)],
        0,
      ),
      extensions: MULTI,
    });
    expect(painted(state)).toEqual([[5, 5]]);
  });
});
