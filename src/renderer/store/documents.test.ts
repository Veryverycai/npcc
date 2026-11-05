import { beforeEach, describe, expect, it } from 'vitest';

import { nextUntitled, nextUntitledName, useDocs } from './documents';

const baseInput = {
  path: null,
  name: 'a.txt',
  encoding: 'utf-8' as const,
  eol: 'lf' as const,
  languageId: 'plaintext',
};

describe('documents store', () => {
  beforeEach(() => {
    useDocs.setState({ docs: [], activeId: null, untitledCounter: 0 });
  });

  it('activates newly added documents', () => {
    const doc = useDocs.getState().add(baseInput);
    expect(useDocs.getState().activeId).toBe(doc.id);
    expect(useDocs.getState().docs).toHaveLength(1);
  });

  it('patches metadata without touching other documents', () => {
    const first = useDocs.getState().add(baseInput);
    const second = useDocs.getState().add({ ...baseInput, name: 'b.txt' });
    useDocs.getState().patch(first.id, { dirty: true, cursorLine: 7 });
    const refreshed = useDocs.getState().docs;
    expect(refreshed.find((doc) => doc.id === first.id)).toMatchObject({
      dirty: true,
      cursorLine: 7,
    });
    expect(refreshed.find((doc) => doc.id === second.id)?.dirty).toBe(false);
  });

  it('moves the active tab to a neighbour when the active one closes', () => {
    const first = useDocs.getState().add(baseInput);
    const second = useDocs.getState().add({ ...baseInput, name: 'b.txt' });
    const third = useDocs.getState().add({ ...baseInput, name: 'c.txt' });
    useDocs.getState().setActive(second.id);
    useDocs.getState().remove(second.id);
    expect(useDocs.getState().docs.map((doc) => doc.id)).toEqual([first.id, third.id]);
    expect(useDocs.getState().activeId).toBe(third.id);
  });

  it('reorders tabs and keeps the active id stable', () => {
    const first = useDocs.getState().add(baseInput);
    const second = useDocs.getState().add({ ...baseInput, name: 'b.txt' });
    const third = useDocs.getState().add({ ...baseInput, name: 'c.txt' });
    useDocs.getState().setActive(second.id);
    useDocs.getState().move(2, 0);
    expect(useDocs.getState().docs.map((doc) => doc.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(useDocs.getState().activeId).toBe(second.id);
  });

  it('ignores out-of-range and no-op tab moves', () => {
    const first = useDocs.getState().add(baseInput);
    const second = useDocs.getState().add({ ...baseInput, name: 'b.txt' });
    useDocs.getState().move(0, 0);
    useDocs.getState().move(-1, 1);
    useDocs.getState().move(0, 5);
    expect(useDocs.getState().docs.map((doc) => doc.id)).toEqual([first.id, second.id]);
  });

  it('clears the active id when the last tab closes', () => {
    const doc = useDocs.getState().add(baseInput);
    useDocs.getState().remove(doc.id);
    expect(useDocs.getState().activeId).toBeNull();
  });

  it('finds open documents by path', () => {
    const doc = useDocs.getState().add({ ...baseInput, path: 'w:\\a.txt' });
    expect(useDocs.getState().findByPath('w:\\a.txt')?.id).toBe(doc.id);
    expect(useDocs.getState().findByPath('w:\\b.txt')).toBeUndefined();
  });

  it('numbers untitled documents', () => {
    expect(nextUntitledName(0)).toBe('新建文件');
    expect(nextUntitledName(3)).toBe('新建文件 3');
  });

  it('skips untitled names an open tab already owns', () => {
    expect(nextUntitled(0, [])).toEqual({ counter: 0, name: '新建文件' });
    // A draft restored from the session keeps its old name at counter 0.
    expect(nextUntitled(0, ['新建文件'])).toEqual({ counter: 1, name: '新建文件 1' });
    expect(nextUntitled(1, ['新建文件', '新建文件 1'])).toEqual({
      counter: 2,
      name: '新建文件 2',
    });
    // Saved tabs carry file names, so they never block the counter.
    expect(nextUntitled(0, ['a.txt', 'b.txt'])).toEqual({ counter: 0, name: '新建文件' });
  });
});
