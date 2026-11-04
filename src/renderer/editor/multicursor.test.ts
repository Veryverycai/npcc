import { describe, expect, it } from 'vitest';

import { findMatches } from './multicursor';

describe('findMatches', () => {
  it('returns every non-overlapping occurrence', () => {
    expect(findMatches('foo bar foo baz foo', 'foo')).toEqual([
      [0, 3],
      [8, 11],
      [16, 19],
    ]);
  });

  it('treats the query as literal text, not a pattern', () => {
    expect(findMatches('a.b axb a.b', 'a.b')).toEqual([
      [0, 3],
      [8, 11],
    ]);
  });

  it('returns nothing for an empty query', () => {
    expect(findMatches('anything', '')).toEqual([]);
  });

  it('advances past matches instead of overlapping them', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it('stops at the limit so huge documents stay responsive', () => {
    expect(findMatches('x x x x x', 'x', 2)).toHaveLength(2);
  });
});
