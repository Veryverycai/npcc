import {
  copyLineDown,
  deleteLine,
  moveLineDown,
  moveLineUp,
  redo,
  selectAll,
  toggleLineComment,
  undo,
} from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

import { HIGHLIGHT_LIMIT_BYTES } from '@shared/constants';
import type { Encoding, Eol, SessionState } from '@shared/types';
import {
  confirmDiscard,
  describeError,
  fileExists,
  openFiles,
  pickSavePath,
  readFile,
  revealInExplorer,
  showMessage,
  writeFile,
} from '@renderer/ipc';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { createEditorState } from '@renderer/editor/createState';
import { gotoLine, selectRangeAt } from '@renderer/editor/goto';
import { detectLanguage } from '@renderer/editor/languages';
import {
  dropState,
  getActiveDocId,
  getActiveView,
  getStoredState,
  storeState,
} from '@renderer/editor/stateRegistry';
import { nextUntitledName, useDocs } from '@renderer/store/documents';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';
import type { RecentEntry } from '@shared/types';
import { pushRecent, saveRecent } from './session';

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

let recentCache: RecentEntry[] = [];

/** The list lives in the UI store so the File menu re-renders as it changes. */
export function setRecentCache(list: RecentEntry[]): void {
  recentCache = list;
  useUi.setState({ recent: list });
}

export function getRecentCache(): RecentEntry[] {
  return recentCache;
}

async function recordRecent(path: string, name: string): Promise<void> {
  const limit = useSettings.getState().settings.recentLimit;
  setRecentCache(pushRecent(recentCache, path, name, limit));
  await saveRecent(recentCache);
}

export function isBigFile(sizeBytes: number): boolean {
  return sizeBytes > HIGHLIGHT_LIMIT_BYTES;
}

export function createNewFile(): void {
  const settings = useSettings.getState().settings;
  const counter = useDocs.getState().untitledCounter;
  const name = nextUntitledName(counter);
  const doc = useDocs.getState().add({
    path: null,
    name,
    encoding: settings.encoding,
    eol: settings.eol,
    languageId: 'plaintext',
  });
  storeState(doc.id, createEditorState({ text: '', languageId: 'plaintext', settings }));
  useDocs.setState({ untitledCounter: counter + 1 });
}

export async function openPath(path: string): Promise<void> {
  const docs = useDocs.getState();
  const existing = docs.findByPath(path);
  if (existing) {
    docs.setActive(existing.id);
    return;
  }
  try {
    const result = await readFile(path);
    const name = baseName(result.path);
    const languageId = detectLanguage(result.path);
    const settings = useSettings.getState().settings;
    const doc = useDocs.getState().add({
      path: result.path,
      name,
      encoding: result.encoding,
      eol: result.eol,
      languageId,
      readOnly: result.truncated,
      truncated: result.truncated,
      sizeBytes: result.sizeBytes,
      mtimeMs: result.mtimeMs,
    });
    storeState(
      doc.id,
      createEditorState({
        text: result.content,
        languageId,
        settings,
        bigFile: isBigFile(result.sizeBytes),
      }),
    );
    await recordRecent(result.path, name);
    if (result.truncated) {
      await showMessage(`「${name}」超过 20 MB，已以只读方式加载前 20 MB。`, '大文件预览');
    } else if (result.hadErrors) {
      await showMessage(
        `「${name}」按 ${result.encoding} 解码时存在无法识别的字节，已用替换字符显示。可用「编码」菜单选择其它编码重新打开。`,
        '编码提示',
      );
    }
  } catch (error) {
    await showMessage(describeError(error), '打开失败');
  }
}

export async function openPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    await openPath(path);
  }
}

/**
 * Files dropped on the window. Every entry is checked first so a directory or
 * a stale path produces one summary message instead of one dialog per item.
 */
export async function openDroppedPaths(paths: string[]): Promise<void> {
  const files: string[] = [];
  let skipped = 0;
  for (const path of paths) {
    let exists = false;
    try {
      exists = await fileExists(path);
    } catch {
      exists = false;
    }
    if (exists) files.push(path);
    else skipped += 1;
  }
  if (files.length > 0) await openPaths(files);
  if (skipped > 0) {
    useUi.getState().setStatusMessage(`已忽略 ${skipped} 个无法打开的项目`);
  }
}

export async function openViaDialog(): Promise<void> {
  const paths = await openFiles();
  if (paths.length > 0) await openPaths(paths);
}

/** Opens a file (reusing the tab when already open) and jumps to a location. */
export async function openLocation(
  path: string,
  line: number,
  column = 1,
  length = 0,
): Promise<void> {
  await openPath(path);
  // A hit carries its length so the jump highlights the matched text itself.
  if (length > 0) selectRangeAt(line, column, length);
  else gotoLine(line, column);
}

function textOf(docId: string): string | null {
  if (useDocs.getState().activeId === docId) {
    const view = getActiveView();
    if (view) return view.state.doc.toString();
  }
  const stored = getStoredState(docId);
  return stored ? stored.doc.toString() : null;
}

/** Current text of a document, from the live view or the stashed state. */
export function documentText(docId: string): string {
  return textOf(docId) ?? '';
}

export async function saveDocument(docId: string, saveAs = false): Promise<boolean> {
  const doc = useDocs.getState().docs.find((item) => item.id === docId);
  if (!doc) return false;
  if (doc.readOnly && !saveAs) {
    await showMessage('该文件以只读预览打开，请使用「另存为」。', '无法保存');
    return false;
  }
  const content = textOf(docId);
  if (content === null) return false;

  let target = doc.path;
  if (!target || saveAs) {
    const picked = await pickSavePath(doc.path ?? doc.name);
    if (!picked) return false;
    target = picked;
  }

  try {
    const result = await writeFile({
      path: target,
      content,
      encoding: doc.encoding,
      eol: doc.eol,
      backup: true,
    });
    const name = baseName(result.path);
    const languageId = doc.languageId === 'plaintext' ? detectLanguage(name) : doc.languageId;
    useDocs.getState().patch(docId, {
      path: result.path,
      name,
      languageId,
      dirty: false,
      readOnly: false,
      truncated: false,
      sizeBytes: result.sizeBytes,
      mtimeMs: result.mtimeMs,
    });
    await recordRecent(result.path, name);
    if (result.hadErrors) {
      await showMessage(
        `部分字符无法用 ${doc.encoding} 表示，已写入替代字符。建议改用 UTF-8。`,
        '编码提示',
      );
    }
    return true;
  } catch (error) {
    await showMessage(describeError(error), '保存失败');
    return false;
  }
}

export async function saveActiveDocument(saveAs = false): Promise<boolean> {
  const activeId = useDocs.getState().activeId;
  if (!activeId) return false;
  return saveDocument(activeId, saveAs);
}

export async function closeDocument(docId: string): Promise<boolean> {
  const doc = useDocs.getState().docs.find((item) => item.id === docId);
  if (!doc) return true;
  if (doc.dirty) {
    const choice = await confirmDiscard(doc.name);
    if (choice === 'cancel') return false;
    if (choice === 'save') {
      const saved = await saveDocument(docId);
      if (!saved) return false;
    }
  }
  dropState(docId);
  useDocs.getState().remove(docId);
  return true;
}

export async function closeActiveDocument(): Promise<boolean> {
  const activeId = useDocs.getState().activeId;
  if (!activeId) return true;
  return closeDocument(activeId);
}

export async function closeAllDocuments(): Promise<boolean> {
  const ids = useDocs.getState().docs.map((doc) => doc.id);
  for (const id of ids) {
    const closed = await closeDocument(id);
    if (!closed) return false;
  }
  return true;
}

/**
 * Closing the window runs the same guard as the OS close button: the window
 * listener in App confirms unsaved tabs and persists the session first.
 */
export async function exitApplication(): Promise<void> {
  await getCurrentWindow().close();
}

export function runEditorCommand(
  command:
    | 'undo'
    | 'redo'
    | 'selectAll'
    | 'deleteLine'
    | 'duplicateLine'
    | 'moveLineUp'
    | 'moveLineDown'
    | 'toggleComment',
): boolean {
  const view = getActiveView();
  if (!view) return false;
  switch (command) {
    case 'undo':
      return undo(view);
    case 'redo':
      return redo(view);
    case 'selectAll':
      return selectAll(view);
    case 'deleteLine':
      return deleteLine(view);
    case 'duplicateLine':
      return copyLineDown(view);
    case 'moveLineUp':
      return moveLineUp(view);
    case 'moveLineDown':
      return moveLineDown(view);
    case 'toggleComment':
      return toggleLineComment(view);
    default:
      return false;
  }
}

export async function copySelection(): Promise<void> {
  const view = getActiveView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    await showMessage(describeError(error), '复制失败');
  }
}

export async function cutSelection(): Promise<void> {
  const view = getActiveView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    view.dispatch({ changes: { from, to, insert: '' } });
  } catch (error) {
    await showMessage(describeError(error), '剪切失败');
  }
}

export async function pasteAtCursor(): Promise<void> {
  const view = getActiveView();
  if (!view) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
  } catch (error) {
    await showMessage(describeError(error), '粘贴失败');
  }
}

export function setActiveEncoding(encoding: Encoding): void {
  const activeId = useDocs.getState().activeId;
  if (!activeId) return;
  useDocs.getState().patch(activeId, { encoding, dirty: true });
}

/** Re-decodes the file on disk with an explicit encoding, without writing it. */
export async function reopenWithEncoding(encoding: Encoding): Promise<void> {
  const activeId = useDocs.getState().activeId;
  const doc = useDocs.getState().docs.find((item) => item.id === activeId);
  if (!doc?.path) {
    await showMessage('只有已保存到磁盘的文件才能重新解码。', '重新打开');
    return;
  }
  try {
    const result = await readFile(doc.path, encoding);
    const nextState = createEditorState({
      text: result.content,
      languageId: doc.languageId,
      settings: useSettings.getState().settings,
      bigFile: isBigFile(result.sizeBytes),
    });
    storeState(doc.id, nextState);
    const view = getActiveView();
    if (view && getActiveDocId() === doc.id) view.setState(nextState);
    useDocs.getState().patch(doc.id, {
      encoding: result.encoding,
      eol: result.eol,
      dirty: false,
      readOnly: result.truncated,
      truncated: result.truncated,
      sizeBytes: result.sizeBytes,
      mtimeMs: result.mtimeMs,
    });
    if (result.hadErrors) {
      await showMessage(
        `「${doc.name}」中有无法用 ${result.encoding} 解码的字节，已用替换字符显示。`,
        '编码提示',
      );
    }
  } catch (error) {
    await showMessage(describeError(error), '重新打开失败');
  }
}

export function setActiveEol(eol: Eol): void {
  const activeId = useDocs.getState().activeId;
  if (!activeId) return;
  useDocs.getState().patch(activeId, { eol, dirty: true });
}

export function setActiveLanguage(languageId: string): void {
  const activeId = useDocs.getState().activeId;
  if (!activeId) return;
  useDocs.getState().patch(activeId, { languageId });
}

export function changeZoom(delta: number): void {
  const settings = useSettings.getState().settings;
  const next = Math.min(40, Math.max(8, settings.fontSize + delta));
  useSettings.getState().update({ fontSize: next });
}

export function resetZoom(): void {
  useSettings.getState().update({ fontSize: 14 });
}

export function buildSessionState(): SessionState {
  const { docs, activeId } = useDocs.getState();
  const tabs = docs.map((doc) => {
    const state = getStoredState(doc.id);
    const isActive = doc.id === activeId;
    const view = isActive ? getActiveView() : null;
    const docText = view ? view.state.doc.toString() : state?.doc.toString();
    const cursor = view ? view.state.selection.main.head : (state?.selection.main.head ?? 0);
    return {
      path: doc.path,
      name: doc.name,
      encoding: doc.encoding,
      eol: doc.eol,
      languageId: doc.languageId,
      draft: doc.path === null && docText ? docText : undefined,
      cursor,
    };
  });
  const activeIndex = Math.max(
    0,
    docs.findIndex((doc) => doc.id === activeId),
  );
  return { schemaVersion: 1, tabs, activeIndex };
}

export async function restoreDocuments(state: SessionState): Promise<void> {
  const settings = useSettings.getState().settings;
  const cursors: Array<{ path: string; cursor: number }> = [];
  for (const tab of state.tabs.slice(0, 40)) {
    if (tab.path) {
      await openPath(tab.path);
      cursors.push({ path: tab.path, cursor: tab.cursor });
    } else if (typeof tab.draft === 'string') {
      const doc = useDocs.getState().add({
        path: null,
        name: tab.name,
        encoding: tab.encoding,
        eol: tab.eol,
        languageId: tab.languageId,
      });
      storeState(
        doc.id,
        createEditorState({
          text: tab.draft,
          languageId: tab.languageId,
          settings,
        }),
      );
      useDocs.getState().patch(doc.id, { dirty: true });
    }
  }

  // Cursors are applied after every tab exists, so the view can be updated too.
  for (const entry of cursors) {
    const doc = useDocs.getState().docs.find((item) => item.path === entry.path);
    if (doc) restoreCursor(doc.id, entry.cursor);
  }

  const target = useDocs.getState().docs[state.activeIndex];
  if (target) useDocs.getState().setActive(target.id);
}

/** Moves a tab back to the cursor offset saved in the session. */
function restoreCursor(docId: string, cursor: number): void {
  const stored = getStoredState(docId);
  if (!stored || cursor <= 0) return;
  const clamped = Math.min(cursor, stored.doc.length);
  storeState(docId, stored.update({ selection: EditorSelection.single(clamped) }).state);
  if (getActiveDocId() === docId) {
    getActiveView()?.dispatch({ selection: { anchor: clamped } });
  }
}

export function focusEditor(): void {
  getActiveView()?.focus();
}

export function revealActiveFile(): void {
  const activeId = useDocs.getState().activeId;
  const doc = useDocs.getState().docs.find((item) => item.id === activeId);
  if (!doc?.path) return;
  void revealInExplorer(doc.path);
}

/** Closes every tab except `docId`, prompting once per dirty document. */
export async function closeOtherDocuments(docId: string): Promise<void> {
  const ids = useDocs
    .getState()
    .docs.filter((doc) => doc.id !== docId)
    .map((doc) => doc.id);
  for (const id of ids) {
    const closed = await closeDocument(id);
    if (!closed) return;
  }
}

/** Closes the tabs that sit to the right of `docId`. */
export async function closeDocumentsToRight(docId: string): Promise<void> {
  const docs = useDocs.getState().docs;
  const index = docs.findIndex((doc) => doc.id === docId);
  if (index === -1) return;
  for (const doc of docs.slice(index + 1)) {
    const closed = await closeDocument(doc.id);
    if (!closed) return;
  }
}

/** Copies text to the clipboard and reports a failure instead of throwing. */
export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    await showMessage(describeError(error), '复制失败');
  }
}

export function insertTextAtCursor(text: string): void {
  const view: EditorView | null = getActiveView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
}
