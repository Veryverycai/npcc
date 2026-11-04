import { describe, expect, it } from 'vitest';

import type { FindQuery } from './find';
import { findAllInText } from './findAll';

const QUERY: FindQuery = {
  search: 'alpha',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
};

describe('findAllInText', () => {
  it('reports 1-based line/column and the containing line', () => {
    const { hits, truncated } = findAllInText('alpha beta\ngamma alpha\n', QUERY);
    expect(truncated).toBe(false);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      line: 1,
      column: 1,
      length: 5,
      preview: 'alpha beta',
      previewOffset: 0,
    });
    expect(hits[1]).toMatchObject({ line: 2, column: 7, preview: 'gamma alpha' });
  });

  it('strips CRLF line endings from previews', () => {
    const { hits } = findAllInText('one alpha\r\ntwo\r\n', QUERY);
    expect(hits).toHaveLength(1);
    expect(hits[0].preview).toBe('one alpha');
    expect(hits[0].line).toBe(1);
  });

  it('honours case sensitivity, whole word and regex flags', () => {
    const text = 'Alpha alpha alphabet';
    expect(findAllInText(text, QUERY).hits).toHaveLength(3);
    expect(findAllInText(text, { ...QUERY, caseSensitive: true }).hits).toHaveLength(2);
    expect(findAllInText(text, { ...QUERY, wholeWord: true }).hits).toHaveLength(2);

    const regex = findAllInText('a1 b22 c333', {
      search: '[a-c]\\d+',
      regex: true,
      caseSensitive: false,
      wholeWord: false,
    });
    expect(regex.hits.map((hit) => hit.length)).toEqual([2, 3, 4]);
  });

  it('caps the list and reports truncation only when more hits exist', () => {
    const text = 'x x x';
    const capped = findAllInText(text, { ...QUERY, search: 'x' }, 2);
    expect(capped.hits).toHaveLength(2);
    expect(capped.truncated).toBe(true);

    const exact = findAllInText('x x', { ...QUERY, search: 'x' }, 2);
    expect(exact.hits).toHaveLength(2);
    expect(exact.truncated).toBe(false);
  });

  it('returns nothing for an empty or invalid query', () => {
    expect(findAllInText('anything', { ...QUERY, search: '' }).hits).toEqual([]);
    expect(
      findAllInText('anything', {
        search: '(',
        regex: true,
        caseSensitive: false,
        wholeWord: false,
      }).hits,
    ).toEqual([]);
  });

  it('windows very long lines around the hit', () => {
    const line = 'a'.repeat(600) + 'alpha' + 'b'.repeat(600);
    const { hits } = findAllInText(line, QUERY);
    expect(hits).toHaveLength(1);
    expect(hits[0].previewOffset).toBeGreaterThan(0);
    const start = hits[0].column - 1 - hits[0].previewOffset;
    expect(hits[0].preview.slice(start, start + hits[0].length)).toBe('alpha');
  });
});
