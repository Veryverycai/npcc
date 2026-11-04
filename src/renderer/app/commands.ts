import { DEFAULT_SETTINGS } from '@shared/constants';
import type { Encoding, Eol } from '@shared/types';
import {
  changeZoom,
  closeActiveDocument,
  closeAllDocuments,
  copySelection,
  createNewFile,
  cutSelection,
  exitApplication,
  getRecentCache,
  openPath,
  openViaDialog,
  pasteAtCursor,
  reopenWithEncoding,
  resetZoom,
  revealActiveFile,
  runEditorCommand,
  saveActiveDocument,
  setActiveEncoding,
  setActiveEol,
  setActiveLanguage,
} from '@renderer/app/actions';
import { repeatFindAll } from '@renderer/app/findAll';
import { THEME_ORDER, THEMES, type ThemeName } from '@renderer/editor/theme';
import { gotoBookmark, toggleBookmarkAtCursor } from '@renderer/editor/bookmarks';
import { LANGUAGES } from '@renderer/editor/languages';
import { playMacro, toggleMacroRecording } from '@renderer/editor/macro';
import { selectAllMatches } from '@renderer/editor/multicursor';
import { toggleOverwrite } from '@renderer/editor/overwrite';
import { getActiveView } from '@renderer/editor/stateRegistry';
import { appVersion, showMessage, toggleFullscreen, openFolder } from '@renderer/ipc';
import { useMacro } from '@renderer/store/macro';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

const LANGUAGE_IDS = new Set(LANGUAGES.map((language) => language.id));

const ENCODING_COMMANDS: Record<string, Encoding> = {
  'encoding.utf8': 'utf-8',
  'encoding.utf8bom': 'utf-8-bom',
  'encoding.gbk': 'gbk',
  'encoding.gb18030': 'gb18030',
  'encoding.utf16le': 'utf-16le',
  'encoding.latin1': 'latin1',
};

const EOL_COMMANDS: Record<string, Eol> = {
  'eol.lf': 'lf',
  'eol.crlf': 'crlf',
  'eol.cr': 'cr',
};

const REOPEN_COMMANDS: Record<string, Encoding> = {
  'reopen.utf8': 'utf-8',
  'reopen.utf8bom': 'utf-8-bom',
  'reopen.gbk': 'gbk',
  'reopen.gb18030': 'gb18030',
  'reopen.utf16le': 'utf-16le',
  'reopen.latin1': 'latin1',
};

/**
 * Every user-visible command funnels through here, so the native menu, the
 * in-app menu and the shortcut table share one implementation.
 */
export async function runCommand(commandId: string): Promise<void> {
  const ui = useUi.getState();
  const settingsStore = useSettings.getState();

  const encoding = ENCODING_COMMANDS[commandId];
  if (encoding) {
    setActiveEncoding(encoding);
    return;
  }
  const eol = EOL_COMMANDS[commandId];
  if (eol) {
    setActiveEol(eol);
    return;
  }
  const reopenEncoding = REOPEN_COMMANDS[commandId];
  if (reopenEncoding) {
    await reopenWithEncoding(reopenEncoding);
    return;
  }
  if (commandId.startsWith('language.')) {
    const languageId = commandId.slice('language.'.length);
    if (LANGUAGE_IDS.has(languageId)) setActiveLanguage(languageId);
    return;
  }
  // "最近打开" 菜单项只带序号，列表本体由渲染层缓存，无需 IPC 回传路径。
  if (commandId.startsWith('recent.')) {
    const index = Number(commandId.slice('recent.'.length));
    const entry = getRecentCache()[index];
    if (entry) await openPath(entry.path);
    else ui.setStatusMessage('该最近文件记录已失效');
    return;
  }
  // 视图 > 主题 > 某个配色模板。
  if (commandId.startsWith('view.theme.')) {
    const name = commandId.slice('view.theme.'.length) as ThemeName;
    if (name in THEMES) settingsStore.update({ theme: name });
    return;
  }

  switch (commandId) {
    case 'file.new':
      createNewFile();
      return;
    case 'file.open':
      await openViaDialog();
      return;
    case 'file.openFolder': {
      const folder = await openFolder();
      if (!folder) return;
      ui.setSearchRoot(folder);
      ui.setSearchPanelOpen(true);
      return;
    }
    case 'file.save':
      await saveActiveDocument();
      return;
    case 'file.saveAs':
      await saveActiveDocument(true);
      return;
    case 'file.close':
      await closeActiveDocument();
      return;
    case 'file.closeAll':
      await closeAllDocuments();
      return;
    case 'file.reveal':
      revealActiveFile();
      return;
    case 'app.exit':
      await exitApplication();
      return;

    case 'edit.undo':
      runEditorCommand('undo');
      return;
    case 'edit.redo':
      runEditorCommand('redo');
      return;
    case 'edit.cut':
      await cutSelection();
      return;
    case 'edit.copy':
      await copySelection();
      return;
    case 'edit.paste':
      await pasteAtCursor();
      return;
    case 'edit.selectAll':
      runEditorCommand('selectAll');
      return;
    case 'edit.duplicateLine':
      runEditorCommand('duplicateLine');
      return;
    case 'edit.deleteLine':
      runEditorCommand('deleteLine');
      return;
    case 'edit.moveLineUp':
      runEditorCommand('moveLineUp');
      return;
    case 'edit.moveLineDown':
      runEditorCommand('moveLineDown');
      return;
    case 'edit.toggleComment':
      runEditorCommand('toggleComment');
      return;
    case 'edit.toggleOverwrite':
      toggleOverwrite();
      return;
    case 'edit.selectAllMatches': {
      const view = getActiveView();
      if (view) selectAllMatches(view);
      return;
    }

    case 'search.find':
      ui.openFind(false);
      return;
    case 'search.replace':
      ui.openFind(true);
      return;
    case 'search.findInFiles':
      ui.setSearchPanelOpen(true);
      return;
    case 'search.findAllInFile':
      repeatFindAll('document');
      return;
    case 'search.findAllInOpen':
      repeatFindAll('open-documents');
      return;
    case 'search.gotoLine':
      ui.setGotoLineOpen(true);
      return;
    case 'bookmark.toggle': {
      const view = getActiveView();
      if (view) toggleBookmarkAtCursor(view);
      return;
    }
    case 'bookmark.next': {
      const view = getActiveView();
      if (view) gotoBookmark(view, 1);
      return;
    }
    case 'bookmark.prev': {
      const view = getActiveView();
      if (view) gotoBookmark(view, -1);
      return;
    }

    case 'view.zoomIn':
      changeZoom(1);
      return;
    case 'view.zoomOut':
      changeZoom(-1);
      return;
    case 'view.zoomReset':
      resetZoom();
      return;
    case 'view.toggleWordWrap':
      settingsStore.update({ wordWrap: !settingsStore.settings.wordWrap });
      return;
    case 'view.toggleWhitespace':
      settingsStore.update({ showWhitespace: !settingsStore.settings.showWhitespace });
      return;
    case 'view.toggleLineNumbers':
      settingsStore.update({ lineNumbers: !settingsStore.settings.lineNumbers });
      return;
    case 'view.cycleTheme': {
      const index = THEME_ORDER.indexOf(settingsStore.settings.theme);
      const next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
      settingsStore.update({ theme: next });
      return;
    }
    case 'view.fullscreen':
      await toggleFullscreen();
      return;
    case 'view.splitHorizontal':
      ui.setSplit(ui.split === 'horizontal' ? 'none' : 'horizontal');
      return;
    case 'view.splitVertical':
      ui.setSplit(ui.split === 'vertical' ? 'none' : 'vertical');
      return;
    case 'view.splitNone':
      ui.setSplit('none');
      return;
    case 'view.compare':
      ui.setDiffOpen(true, null);
      return;

    case 'macro.record':
      toggleMacroRecording();
      return;
    case 'macro.play': {
      const view = getActiveView();
      if (!view) return;
      if (!playMacro(view)) {
        ui.setStatusMessage('没有可回放的宏，请先录制');
        return;
      }
      ui.setStatusMessage('宏回放完成');
      return;
    }
    case 'macro.clear':
      useMacro.getState().clear();
      ui.setStatusMessage('已清空宏');
      return;
    case 'view.settings':
      ui.setSettingsOpen(true);
      return;

    case 'plugin.manage':
      ui.setPluginsOpen(true);
      return;

    case 'help.about': {
      const version = await appVersion();
      await showMessage(
        [
          `Npcc ${version || 'dev'}`,
          '轻量文本编辑器（Tauri 2 + React + CodeMirror 6）',
          '',
          `默认编码 ${DEFAULT_SETTINGS.encoding.toUpperCase()}，默认换行 ${DEFAULT_SETTINGS.eol.toUpperCase()}`,
          '设置与最近文件保存在应用配置目录。',
          '',
          '初衷：Notepad++ 的作者作恶 —— SB 无脑黑 + 反华，那就再造一个轮子。',
          '所以有了 Npcc：Tauri 2 + React 19 + CodeMirror 6，自己的编辑器自己写。',
        ].join('\n'),
        '关于 Npcc',
      );
      return;
    }
    default:
      // Unknown ids are ignored: a stale menu item should never crash the UI.
      return;
  }
}
