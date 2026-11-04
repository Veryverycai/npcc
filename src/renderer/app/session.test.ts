import { describe, expect, it } from 'vitest';

import type { RecentEntry } from '@shared/types';
import { pushRecent } from '@renderer/app/session';

function entry(path: string, openedAt: number): RecentEntry {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return { path, name, openedAt };
}

describe('pushRecent', () => {
  it('prepends the newest file and trims to the limit', () => {
    let list: RecentEntry[] = [];
    for (let index = 0; index < 7; index += 1) {
      list = pushRecent(list, `C:/tmp/f${index}.txt`, `f${index}.txt`, 5);
    }
    expect(list.map((item) => item.name)).toEqual([
      'f6.txt',
      'f5.txt',
      'f4.txt',
      'f3.txt',
      'f2.txt',
    ]);
  });

  it('moves a listed file back to the top without duplicating it', () => {
    const list = [entry('C:/a.txt', 1), entry('C:/b.txt', 2)];
    const next = pushRecent(list, 'C:/b.txt', 'b.txt', 5);
    expect(next.map((item) => item.path)).toEqual(['C:/b.txt', 'C:/a.txt']);
    expect(next).toHaveLength(2);
  });

  it('stamps the moment the file was opened', () => {
    const before = Date.now();
    const [first] = pushRecent([], 'C:/a.txt', 'a.txt', 5);
    expect(first.openedAt).toBeGreaterThanOrEqual(before);
    expect(first.path).toBe('C:/a.txt');
  });

  it('keeps one entry even when the limit is zero', () => {
    expect(pushRecent([], 'C:/a.txt', 'a.txt', 0)).toHaveLength(1);
  });
});
