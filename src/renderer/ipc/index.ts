import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ask,
  message,
  open as openDialog,
  save as saveDialog,
} from '@tauri-apps/plugin-dialog';

import type {
  Encoding,
  PluginManifest,
  PluginRpcReply,
  PluginRpcRequest,
  ReadFileResult,
  SearchOptions,
  SearchProgress,
  WriteFileRequest,
  WriteFileResult,
} from '@shared/types';

/**
 * The only place that knows about the host. Everything above it talks to this
 * narrow interface, which is what keeps a future Electron fallback cheap.
 */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const TEXT_FILTERS = [
  {
    name: '文本文件',
    extensions: ['txt', 'md', 'log', 'json', 'xml', 'ini', 'yml', 'yaml', 'csv'],
  },
  {
    name: '源代码',
    extensions: [
      'c',
      'h',
      'cpp',
      'hpp',
      'cc',
      'cs',
      'java',
      'js',
      'jsx',
      'ts',
      'tsx',
      'py',
      'go',
      'rs',
      'php',
      'sql',
      'sh',
      'bat',
      'ps1',
      'html',
      'css',
    ],
  },
  { name: '所有文件', extensions: ['*'] },
];

export async function openFiles(): Promise<string[]> {
  if (!isTauri) return [];
  const picked = await openDialog({ multiple: true, directory: false, filters: TEXT_FILTERS });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export async function openFolder(): Promise<string | null> {
  if (!isTauri) return null;
  const picked = await openDialog({ multiple: false, directory: true });
  return typeof picked === 'string' ? picked : null;
}

export async function pickSavePath(defaultPath?: string): Promise<string | null> {
  if (!isTauri) return null;
  const picked = await saveDialog({
    defaultPath,
    filters: TEXT_FILTERS,
  });
  return picked ?? null;
}

/** Passing an encoding forces a re-decode instead of detection. */
export async function readFile(path: string, encoding?: Encoding): Promise<ReadFileResult> {
  return invoke<ReadFileResult>('read_file', { path, encoding: encoding ?? null });
}

export async function writeFile(request: WriteFileRequest): Promise<WriteFileResult> {
  return invoke<WriteFileResult>('write_file', { request });
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>('file_exists', { path });
}

export async function revealInExplorer(path: string): Promise<void> {
  await invoke('reveal_in_explorer', { path });
}

export async function searchInFolder(options: SearchOptions): Promise<number> {
  return invoke<number>('search_in_folder', { options });
}

export async function cancelSearch(searchId: number): Promise<boolean> {
  return invoke<boolean>('cancel_search', { searchId });
}

export async function onSearchProgress(
  callback: (progress: SearchProgress) => void,
): Promise<UnlistenFn> {
  return listen<SearchProgress>('search://progress', (event) => callback(event.payload));
}

export async function startupPaths(): Promise<string[]> {
  if (!isTauri) return [];
  return invoke<string[]>('startup_paths');
}

/** Files forwarded when a second instance is launched (single-instance plugin). */
export async function onOpenPaths(handler: (paths: string[]) => void): Promise<UnlistenFn> {
  return listen<string[]>('open://paths', (event) => handler(event.payload));
}

export async function loadState<T>(name: 'settings' | 'session' | 'recent'): Promise<T | null> {
  if (!isTauri) {
    const raw = localStorage.getItem(`npcc.${name}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  return invoke<T | null>('load_state', { name });
}

export async function saveState(
  name: 'settings' | 'session' | 'recent',
  value: unknown,
): Promise<void> {
  if (!isTauri) {
    localStorage.setItem(`npcc.${name}`, JSON.stringify(value));
    return;
  }
  await invoke('save_state', { name, value });
}

export async function onCloseRequested(
  handler: () => boolean | Promise<boolean>,
): Promise<UnlistenFn> {
  if (!isTauri) return async () => {};
  return getCurrentWindow().onCloseRequested(async (event) => {
    const shouldClose = await handler();
    if (!shouldClose) {
      event.preventDefault();
    }
  });
}

export async function confirmDiscard(fileName: string): Promise<'save' | 'discard' | 'cancel'> {
  if (!isTauri) {
    return window.confirm(`${fileName} 有未保存的修改，确定放弃吗？`) ? 'discard' : 'cancel';
  }
  const wantsSave = await ask(`「${fileName}」已修改，是否保存？`, {
    title: 'Npcc',
    kind: 'warning',
    okLabel: '保存',
    cancelLabel: '不保存',
  });
  return wantsSave ? 'save' : 'discard';
}

export async function confirmReplaceAll(count: number): Promise<boolean> {
  if (!isTauri) return window.confirm(`将替换 ${count} 处匹配，是否继续？`);
  return ask(`将替换 ${count} 处匹配，是否继续？`, {
    title: '全部替换',
    kind: 'warning',
    okLabel: '替换',
    cancelLabel: '取消',
  });
}

export async function showMessage(text: string, title = 'Npcc'): Promise<void> {
  if (!isTauri) {
    window.alert(text);
    return;
  }
  await message(text, { title });
}

export async function toggleFullscreen(): Promise<void> {
  if (!isTauri) return;
  const win = getCurrentWindow();
  const isFullscreen = await win.isFullscreen();
  await win.setFullscreen(!isFullscreen);
}

/**
 * Version baked into the bundle by `tauri.conf.json`. Read at runtime so the
 * title bar and the About box cannot drift from the shipped build.
 */
export async function appVersion(): Promise<string> {
  if (!isTauri) return '';
  return getVersion();
}

/** The renderer owns the window title, so the version is never hard-coded. */
export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri) return;
  await getCurrentWindow().setTitle(title);
}

export async function listPlugins(): Promise<PluginManifest[]> {
  if (!isTauri) return [];
  return invoke<PluginManifest[]>('list_plugins');
}

export async function configDir(): Promise<string> {
  if (!isTauri) return '';
  return invoke<string>('config_dir');
}

/** Opens (or focuses) the isolated webview window of a plugin. */
export async function openPluginWindow(id: string): Promise<void> {
  await invoke('open_plugin_window', { id });
}

/** RPC channel: plugin windows emit requests, this side answers them. */
export async function onPluginRpc(
  handler: (request: PluginRpcRequest) => void,
): Promise<UnlistenFn> {
  return listen<PluginRpcRequest>('plugin://rpc', (event) => handler(event.payload));
}

export async function replyToPlugin(windowLabel: string, reply: PluginRpcReply): Promise<void> {
  if (!isTauri) return;
  await emitTo(windowLabel, 'plugin://reply', reply);
}

export function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const candidate = error as { message?: string; code?: string };
    if (candidate.message) return candidate.message;
    if (candidate.code) return candidate.code;
  }
  return String(error);
}
