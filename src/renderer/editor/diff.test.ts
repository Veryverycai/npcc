import { describe, expect, it } from 'vitest';

import { diffLines } from './diff';

describe('diffLines', () => {
  it('reports no differences for identical text', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc');
    expect(result.chunks).toBe(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.rows.every((row) => row.kind === 'equal')).toBe(true);
  });

  it('pairs a replaced line into one change chunk', () => {
    const result = diffLines('a\nb\nc', 'a\nB\nc');
    expect(result.chunks).toBe(1);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    const changed = result.rows.filter((row) => row.kind === 'change');
    expect(changed).toHaveLength(1);
    expect(changed[0].leftText).toBe('b');
    expect(changed[0].rightText).toBe('B');
    expect(changed[0].chunk).toBe(1);
  });

  it('marks added and removed lines with the right side empty', () => {
    const added = diffLines('a\nc', 'a\nb\nc');
    expect(added.chunks).toBe(1);
    expect(added.added).toBe(1);
    expect(added.removed).toBe(0);
    const rows = added.rows.filter((row) => row.kind === 'add');
    expect(rows[0].leftText).toBeNull();
    expect(rows[0].rightText).toBe('b');

    const removed = diffLines('a\nb\nc', 'a\nc');
    expect(removed.chunks).toBe(1);
    expect(removed.added).toBe(0);
    expect(removed.removed).toBe(1);
  });

  it('keeps line numbers aligned across CRLF and LF', () => {
    const result = diffLines('a\r\nb\r\nc', 'a\nb\nc');
    expect(result.chunks).toBe(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[2].leftLine).toBe(3);
    expect(result.rows[2].rightLine).toBe(3);
  });

  it('numbers multiple chunks independently', () => {
    const result = diffLines('a\nb\nc\nd', 'A\nb\nC\nd');
    expect(result.chunks).toBe(2);
    expect(result.rows.filter((row) => row.kind !== 'equal').map((row) => row.chunk)).toEqual([
      1, 2,
    ]);

    // The untouched middle line must keep both side line numbers.
    const equal = result.rows.find((row) => row.kind === 'equal');
    expect(equal?.leftLine).toBe(2);
    expect(equal?.rightLine).toBe(2);
  });
});
