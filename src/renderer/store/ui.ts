import { create } from 'zustand';

import type { FindQuery } from '@renderer/editor/find';
import type { FindAllResult } from '@renderer/editor/findAll';

/** `horizontal` stacks the two panes, `vertical` puts them side by side. */
export type SplitMode = 'none' | 'horizontal' | 'vertical';

const EMPTY_FIND_QUERY: FindQuery = {
  search: '',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
};

interface UiStore {
  findOpen: boolean;
  findReplaceMode: boolean;
  searchPanelOpen: boolean;
  searchRoot: string | null;
  settingsOpen: boolean;
  gotoLineOpen: boolean;
  pluginsOpen: boolean;
  statusMessage: string | null;
  /** Insert vs. overwrite typing mode, reflected by the INS/OVR indicator. */
  overwrite: boolean;
  split: SplitMode;
  diffOpen: boolean;
  /** Tab compared against the active one, `null` picks the next tab. */
  diffTargetId: string | null;
  /** Last query typed in the find panel; menu commands reuse it. */
  findQuery: FindQuery;
  /** Result of the most recent "find all" run, shown in the bottom pane. */
  findResults: FindAllResult | null;
  findResultsOpen: boolean;
  findResultsHeight: number;
  openFind: (replace?: boolean) => void;
  closeFind: () => void;
  setSearchPanelOpen: (open: boolean) => void;
  setSearchRoot: (root: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setGotoLineOpen: (open: boolean) => void;
  setPluginsOpen: (open: boolean) => void;
  setStatusMessage: (message: string | null) => void;
  setOverwrite: (overwrite: boolean) => void;
  toggleOverwrite: () => void;
  setSplit: (split: SplitMode) => void;
  setDiffOpen: (open: boolean, targetId?: string | null) => void;
  setFindQuery: (query: FindQuery) => void;
  setFindResults: (result: FindAllResult) => void;
  closeFindResults: () => void;
  setFindResultsHeight: (height: number) => void;
}

export const useUi = create<UiStore>((set) => ({
  findOpen: false,
  findReplaceMode: false,
  searchPanelOpen: false,
  searchRoot: null,
  settingsOpen: false,
  gotoLineOpen: false,
  pluginsOpen: false,
  statusMessage: null,
  overwrite: false,
  split: 'none',
  diffOpen: false,
  diffTargetId: null,
  findQuery: EMPTY_FIND_QUERY,
  findResults: null,
  findResultsOpen: false,
  findResultsHeight: 220,
  openFind: (replace = false) => set({ findOpen: true, findReplaceMode: replace }),
  closeFind: () => set({ findOpen: false }),
  setSearchPanelOpen: (open) => set({ searchPanelOpen: open }),
  setSearchRoot: (root) => set({ searchRoot: root }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setGotoLineOpen: (open) => set({ gotoLineOpen: open }),
  setPluginsOpen: (open) => set({ pluginsOpen: open }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setOverwrite: (overwrite) => set({ overwrite }),
  toggleOverwrite: () => set((state) => ({ overwrite: !state.overwrite })),
  setSplit: (split) => set({ split }),
  setDiffOpen: (open, targetId) =>
    set((state) => ({
      diffOpen: open,
      diffTargetId: targetId === undefined ? state.diffTargetId : targetId,
    })),
  setFindQuery: (query) => set({ findQuery: query }),
  setFindResults: (result) =>
    set((state) => ({
      findResults: result,
      findResultsOpen: true,
      // Never let the pane swallow the editor on a very short window.
      findResultsHeight: Math.max(120, state.findResultsHeight),
    })),
  closeFindResults: () => set({ findResultsOpen: false }),
  setFindResultsHeight: (height) =>
    set({ findResultsHeight: Math.min(560, Math.max(120, Math.round(height))) }),
}));
