import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import {
  buildRegex,
  collectMatches,
  countMatches,
  currentMatchIndex,
  escapeRegExp,
  type FindQuery,
} from './find';

function stateOf(text: string): EditorState {
  return EditorState.create({ doc: text });
}

function queryOf(search: string, extra: Partial<FindQuery> = {}): FindQuery {
  return { search, regex: false, caseSensitive: false, wholeWord: false, ...extra };
}

describe('buildRegex', () => {
  it('escapes literal queries', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    const regex = buildRegex(queryOf('a.b'))!;
    expect(regex.test('xa.by')).toBe(true);
    expect(regex.test('axby')).toBe(false);
  });

  it('is case-insensitive unless asked otherwise', () => {
    expect(buildRegex(queryOf('hello'))!.test('HELLO')).toBe(true);
    expect(buildRegex(queryOf('hello', { caseSensitive: true }))!.test('HELLO')).toBe(false);
  });

  it('honours whole-word matching', () => {
    const regex = buildRegex(queryOf('cat', { wholeWord: true }))!;
    expect(regex.test('a cat sat')).toBe(true);
    expect(regex.test('concatenate')).toBe(false);
  });

  it('returns null for invalid regular expressions', () => {
    expect(buildRegex(queryOf('(unclosed', { regex: true }))).toBeNull();
    expect(buildRegex(queryOf(''))).toBeNull();
  });
});

describe('collectMatches', () => {
  it('finds every occurrence with its offsets', () => {
    const matches = collectMatches(stateOf('foo bar foo'), queryOf('foo'));
    expect(matches).toEqual([
      { from: 0, to: 3 },
      { from: 8, to: 11 },
    ]);
  });

  it('supports capture groups in regex mode', () => {
    const matches = collectMatches(stateOf('a1 b2 c3'), queryOf('[a-c]\\d', { regex: true }));
    expect(matches).toHaveLength(3);
    expect(countMatches(stateOf('a1 b2 c3'), queryOf('[a-c]\\d', { regex: true }))).toBe(3);
  });

  it('caps the result set', () => {
    const text = 'x '.repeat(50);
    expect(collectMatches(stateOf(text), queryOf('x'), 10)).toHaveLength(10);
  });
});

describe('currentMatchIndex', () => {
  it('reports the match at or after the cursor', () => {
    const state = EditorState.create({
      doc: 'foo foo foo',
      selection: { anchor: 4 },
    });
    const matches = collectMatches(state, queryOf('foo'));
    expect(currentMatchIndex(state, matches)).toBe(1);
  });

  it('returns -1 when nothing matches', () => {
    expect(currentMatchIndex(stateOf('abc'), [])).toBe(-1);
  });
});
