import { SCHEMA_VERSION } from '@shared/constants';
import type { RecentEntry, SessionState } from '@shared/types';
import { loadState, saveState } from '@renderer/ipc';

export async function loadSession(): Promise<SessionState | null> {
  const stored = await loadState<SessionState>('session');
  if (!stored || !Array.isArray(stored.tabs)) return null;
  return { ...stored, schemaVersion: SCHEMA_VERSION };
}

export async function saveSession(state: SessionState): Promise<void> {
  await saveState('session', { ...state, schemaVersion: SCHEMA_VERSION });
}

export async function loadRecent(): Promise<RecentEntry[]> {
  const stored = await loadState<RecentEntry[]>('recent');
  if (!Array.isArray(stored)) return [];
  return stored.filter((entry) => entry && typeof entry.path === 'string');
}

/** Prepends a path, removes duplicates and trims to `limit` entries. */
export function pushRecent(
  list: RecentEntry[],
  path: string,
  name: string,
  limit: number,
): RecentEntry[] {
  const entry: RecentEntry = { path, name, openedAt: Date.now() };
  const withoutDuplicate = list.filter((item) => item.path !== path);
  return [entry, ...withoutDuplicate].slice(0, Math.max(1, limit));
}

export async function saveRecent(list: RecentEntry[]): Promise<void> {
  await saveState('recent', list);
}
