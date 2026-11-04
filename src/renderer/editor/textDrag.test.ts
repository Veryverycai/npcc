import { describe, expect, it } from 'vitest';

import { applyTextMove, planTextMove } from './textDrag';

const TEXT = 'alpha beta gamma delta';

function move(from: number, to: number, target: number): string | null {
  const plan = planTextMove(TEXT, from, to, target);
  return plan ? applyTextMove(TEXT, plan) : null;
}

describe('planTextMove', () => {
  it('moves a selection forward', () => {
    // "beta " (6..11) dropped right before "delta" (17).
    expect(move(6, 11, 17)).toBe('alpha gamma beta delta');
  });

  it('moves a selection backwards', () => {
    // "two," (4..8) dropped at offset 0.
    const text = 'one,two,three';
    const plan = planTextMove(text, 4, 8, 0);
    expect(plan).not.toBeNull();
    expect(applyTextMove(text, plan!)).toBe('two,one,three');
  });

  it('keeps the caret after the moved block in both directions', () => {
    expect(planTextMove(TEXT, 6, 11, 17)?.caret).toBe(17);
    expect(planTextMove('one,two,three', 4, 8, 0)?.caret).toBe(4);
  });

  it('ignores drops inside or on the edge of the dragged range', () => {
    expect(planTextMove(TEXT, 6, 11, 8)).toBeNull();
    expect(planTextMove(TEXT, 6, 11, 6)).toBeNull();
    expect(planTextMove(TEXT, 6, 11, 11)).toBeNull();
  });

  it('rejects empty ranges and out-of-document targets', () => {
    expect(planTextMove(TEXT, 4, 4, 0)).toBeNull();
    expect(planTextMove(TEXT, 0, 4, TEXT.length + 3)).toBeNull();
  });

  it('can move a whole line down one line', () => {
    const doc = 'one\ntwo\n';
    const plan = planTextMove(doc, 0, 4, doc.length);
    expect(plan).not.toBeNull();
    expect(applyTextMove(doc, plan!)).toBe('two\none\n');
  });
});
