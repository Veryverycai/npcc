import { create } from 'zustand';

import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '@shared/constants';
import type { AppSettings } from '@shared/types';
import { loadState, saveState } from '@renderer/ipc';

type PersistedSettings = Partial<AppSettings> & { schemaVersion?: number };

export function mergeSettings(stored: PersistedSettings | null): AppSettings {
  if (!stored) return { ...DEFAULT_SETTINGS };
  // Unknown/old schemas are merged over the defaults instead of being trusted,
  // so a stale file can never leave a required field undefined.
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...stored, schemaVersion: SCHEMA_VERSION };
  merged.fontSize = clamp(merged.fontSize, 8, 48);
  merged.tabSize = clamp(merged.tabSize, 1, 12);
  merged.recentLimit = clamp(merged.recentLimit, 5, 50);
  return merged;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

interface SettingsStore {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(settings: AppSettings): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void saveState('settings', settings);
  }, 300);
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  hydrated: false,
  hydrate: async () => {
    const stored = await loadState<PersistedSettings>('settings');
    set({ settings: mergeSettings(stored), hydrated: true });
  },
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    schedulePersist(next);
  },
}));
