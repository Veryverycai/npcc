import { create } from 'zustand';

import type { Encoding, Eol } from '@shared/types';

export interface DocRecord {
  id: string;
  path: string | null;
  name: string;
  encoding: Encoding;
  eol: Eol;
  languageId: string;
  readOnly: boolean;
  truncated: boolean;
  sizeBytes: number;
  mtimeMs: number;
  dirty: boolean;
  cursorLine: number;
  cursorColumn: number;
  selectionLength: number;
  totalLines: number;
  characterCount: number;
}

export interface NewDocInput {
  path: string | null;
  name: string;
  encoding: Encoding;
  eol: Eol;
  languageId: string;
  readOnly?: boolean;
  truncated?: boolean;
  sizeBytes?: number;
  mtimeMs?: number;
}

interface DocsStore {
  docs: DocRecord[];
  activeId: string | null;
  untitledCounter: number;
  add: (input: NewDocInput, activate?: boolean) => DocRecord;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  patch: (id: string, patch: Partial<DocRecord>) => void;
  /** Reorders tabs after a drag on the tab strip. */
  move: (from: number, to: number) => void;
  clearAll: () => void;
  findByPath: (path: string) => DocRecord | undefined;
}

let docSeq = 0;

export function newDocId(): string {
  docSeq += 1;
  return `doc-${Date.now().toString(36)}-${docSeq}`;
}

export const useDocs = create<DocsStore>((set, get) => ({
  docs: [],
  activeId: null,
  untitledCounter: 0,
  add: (input, activate = true) => {
    const record: DocRecord = {
      id: newDocId(),
      path: input.path,
      name: input.name,
      encoding: input.encoding,
      eol: input.eol,
      languageId: input.languageId,
      readOnly: input.readOnly ?? false,
      truncated: input.truncated ?? false,
      sizeBytes: input.sizeBytes ?? 0,
      mtimeMs: input.mtimeMs ?? 0,
      dirty: false,
      cursorLine: 1,
      cursorColumn: 1,
      selectionLength: 0,
      totalLines: 1,
      characterCount: 0,
    };
    set((state) => ({
      docs: [...state.docs, record],
      activeId: activate ? record.id : state.activeId,
    }));
    return record;
  },
  remove: (id) => {
    const state = get();
    const index = state.docs.findIndex((doc) => doc.id === id);
    if (index === -1) return;
    const remaining = state.docs.filter((doc) => doc.id !== id);
    let nextActive = state.activeId;
    if (state.activeId === id) {
      const fallback = remaining[index] ?? remaining[index - 1] ?? remaining[0];
      nextActive = fallback ? fallback.id : null;
    }
    set({ docs: remaining, activeId: nextActive });
  },
  setActive: (id) => set({ activeId: id }),
  patch: (id, patch) =>
    set((state) => ({
      docs: state.docs.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
    })),
  move: (from, to) =>
    set((state) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.docs.length ||
        to >= state.docs.length
      ) {
        return {};
      }
      const docs = [...state.docs];
      const [moved] = docs.splice(from, 1);
      docs.splice(to, 0, moved);
      return { docs };
    }),
  clearAll: () => set({ docs: [], activeId: null }),
  findByPath: (path) => get().docs.find((doc) => doc.path === path),
}));

export function nextUntitledName(counter: number): string {
  return counter === 0 ? '新建文件' : `新建文件 ${counter}`;
}

export interface UntitledTab {
  counter: number;
  name: string;
}

/**
 * Next untitled name, skipping the ones an open tab already owns. A draft
 * restored from the previous session keeps the name it was stored with, so the
 * counter on its own would hand a second tab the same label -- two tabs called
 * 新建文件, and the saved one looked as if its name had not changed.
 */
export function nextUntitled(counter: number, takenNames: string[]): UntitledTab {
  const taken = new Set(takenNames);
  let next = counter;
  while (taken.has(nextUntitledName(next))) next += 1;
  return { counter: next, name: nextUntitledName(next) };
}
