import type { AppSettings, Encoding, Eol, RecentEntry } from '@shared/types';
import { THEME_ORDER, THEMES } from '@renderer/editor/theme';
import { LANGUAGES } from '@renderer/editor/languages';
import type { SplitMode } from '@renderer/store/ui';

/**
 * The menu bar is drawn by the renderer instead of the OS: a Win32 menu keeps
 * its own grey palette and cannot follow the editor theme. Every entry only
 * carries a command id, exactly like the old native menu, so `runCommand`
 * stays the single implementation of each action.
 */
export type MenuNode =
  | {
      type: 'item';
      id: string;
      label: string;
      /** Display form of the shortcut, e.g. `Ctrl+Shift+S`. */
      accel?: string;
      checked?: boolean;
      disabled?: boolean;
    }
  | { type: 'separator' }
  | { type: 'submenu'; label: string; items: MenuNode[] };

export interface MenuGroup {
  label: string;
  items: MenuNode[];
}

export interface MenuState {
  settings: AppSettings;
  /** Active tab, `null` when the window only shows the welcome pane. */
  doc: { encoding: Encoding; eol: Eol; languageId: string } | null;
  recent: RecentEntry[];
  split: SplitMode;
  overwrite: boolean;
}

const ENCODING_LABELS: Array<[string, Encoding, string]> = [
  ['encoding.utf8', 'utf-8', '转为 UTF-8'],
  ['encoding.utf8bom', 'utf-8-bom', '转为 UTF-8 BOM'],
  ['encoding.gbk', 'gbk', '转为 GBK'],
  ['encoding.gb18030', 'gb18030', '转为 GB18030'],
  ['encoding.utf16le', 'utf-16le', '转为 UTF-16 LE'],
  ['encoding.latin1', 'latin1', '转为 ISO-8859-1'],
];

const EOL_LABELS: Array<[string, Eol, string]> = [
  ['eol.lf', 'lf', '转为 LF'],
  ['eol.crlf', 'crlf', '转为 CRLF'],
  ['eol.cr', 'cr', '转为 CR'],
];

const REOPEN_LABELS: Array<[string, string]> = [
  ['reopen.utf8', '以 UTF-8 重新打开'],
  ['reopen.gbk', '以 GBK 重新打开'],
  ['reopen.gb18030', '以 GB18030 重新打开'],
  ['reopen.utf16le', '以 UTF-16 LE 重新打开'],
  ['reopen.latin1', '以 ISO-8859-1 重新打开'],
];

function item(
  id: string,
  label: string,
  accel?: string,
  extra?: { checked?: boolean; disabled?: boolean },
): MenuNode {
  return { type: 'item', id, label, accel, ...extra };
}

const separator: MenuNode = { type: 'separator' };

function themeMenu(settings: AppSettings): MenuNode {
  const themes: MenuNode[] = THEME_ORDER.map((name) =>
    item(`view.theme.${name}`, THEMES[name].label, undefined, {
      checked: settings.theme === name,
    }),
  );
  return {
    type: 'submenu',
    label: '配色模板',
    items: [...themes, separator, item('view.cycleTheme', '下一个模板')],
  };
}

function languageMenu(doc: MenuState['doc']): MenuGroup {
  return {
    label: '语言',
    items: LANGUAGES.map((language) =>
      item(`language.${language.id}`, language.label, undefined, {
        checked: doc?.languageId === language.id,
      }),
    ),
  };
}

function recentMenu(recent: RecentEntry[]): MenuNode {
  if (recent.length === 0) {
    return {
      type: 'submenu',
      label: '最近打开',
      items: [item('recent.none', '（空）', undefined, { disabled: true })],
    };
  }
  return {
    type: 'submenu',
    label: '最近打开',
    items: recent.map((entry, index) => item(`recent.${index}`, entry.name)),
  };
}

/** Full menu tree for the current application state. */
export function menuModel(state: MenuState): MenuGroup[] {
  const { settings, doc, recent, split, overwrite } = state;
  const hasDoc = doc !== null;

  return [
    {
      label: '文件',
      items: [
        item('file.new', '新建', 'Ctrl+N'),
        item('file.open', '打开...', 'Ctrl+O'),
        item('file.openFolder', '打开文件夹...'),
        recentMenu(recent),
        separator,
        item('file.save', '保存', 'Ctrl+S', { disabled: !hasDoc }),
        item('file.saveAs', '另存为...', 'Ctrl+Shift+S', { disabled: !hasDoc }),
        separator,
        item('file.close', '关闭标签', 'Ctrl+W', { disabled: !hasDoc }),
        item('file.closeAll', '关闭全部', undefined, { disabled: !hasDoc }),
        separator,
        item('file.reveal', '在资源管理器中显示', undefined, {
          disabled: !hasDoc,
        }),
        separator,
        item('app.exit', '退出'),
      ],
    },
    {
      label: '编辑',
      items: [
        item('edit.undo', '撤销', 'Ctrl+Z'),
        item('edit.redo', '重做', 'Ctrl+Y'),
        separator,
        item('edit.cut', '剪切', 'Ctrl+X'),
        item('edit.copy', '复制', 'Ctrl+C'),
        item('edit.paste', '粘贴', 'Ctrl+V'),
        item('edit.selectAll', '全选', 'Ctrl+A'),
        separator,
        item('edit.duplicateLine', '复制当前行', 'Ctrl+D'),
        item('edit.deleteLine', '删除当前行', 'Ctrl+L'),
        item('edit.moveLineUp', '上移当前行', 'Alt+↑'),
        item('edit.moveLineDown', '下移当前行', 'Alt+↓'),
        item('edit.toggleComment', '切换行注释', 'Ctrl+Q'),
        separator,
        item('edit.toggleOverwrite', '覆盖模式', undefined, { checked: overwrite }),
        item('edit.selectAllMatches', '选中全部相同文本', 'Ctrl+Shift+L'),
      ],
    },
    {
      label: '搜索',
      items: [
        item('search.find', '查找', 'Ctrl+F'),
        item('search.replace', '替换', 'Ctrl+H'),
        item('search.findInFiles', '在文件夹中查找', 'Ctrl+Shift+F'),
        separator,
        item('search.findAllInFile', '在本文档中查找全部', 'Ctrl+Shift+E'),
        item('search.findAllInOpen', '在所有打开文档中查找全部'),
        separator,
        item('search.gotoLine', '转到行...', 'Ctrl+G'),
        separator,
        item('bookmark.toggle', '切换书签', 'Ctrl+F2'),
        item('bookmark.next', '下一个书签', 'F2'),
        item('bookmark.prev', '上一个书签', 'Shift+F2'),
      ],
    },
    {
      label: '视图',
      items: [
        item('view.zoomIn', '放大', 'Ctrl+='),
        item('view.zoomOut', '缩小', 'Ctrl+-'),
        item('view.zoomReset', '重置缩放', 'Ctrl+0'),
        separator,
        item('view.toggleWordWrap', '自动换行', undefined, { checked: settings.wordWrap }),
        item('view.toggleWhitespace', '显示空白字符', undefined, {
          checked: settings.showWhitespace,
        }),
        item('view.toggleLineNumbers', '显示行号', undefined, {
          checked: settings.lineNumbers,
        }),
        themeMenu(settings),
        separator,
        item('view.splitVertical', '左右分屏', undefined, { checked: split === 'vertical' }),
        item('view.splitHorizontal', '上下分屏', undefined, {
          checked: split === 'horizontal',
        }),
        item('view.splitNone', '取消分屏', undefined, { disabled: split === 'none' }),
        item('view.compare', '与另一标签对比...'),
        separator,
        item('view.fullscreen', '全屏', 'F11'),
        item('view.settings', '首选项...', 'Ctrl+,'),
      ],
    },
    languageMenu(doc),
    {
      label: '编码',
      items: [
        ...ENCODING_LABELS.map(([id, encoding, label]) =>
          item(id, label, undefined, { checked: doc?.encoding === encoding }),
        ),
        separator,
        ...EOL_LABELS.map(([id, eol, label]) =>
          item(id, label, undefined, { checked: doc?.eol === eol }),
        ),
        separator,
        ...REOPEN_LABELS.map(([id, label]) =>
          item(id, label, undefined, { disabled: !hasDoc }),
        ),
      ],
    },
    {
      label: '宏',
      items: [
        item('macro.record', '开始/结束录制', 'Ctrl+Shift+R'),
        item('macro.play', '回放宏', 'Ctrl+Shift+P'),
        separator,
        item('macro.clear', '清空宏'),
      ],
    },
    {
      label: '插件',
      items: [item('plugin.manage', '插件列表...')],
    },
    {
      label: '帮助',
      items: [
        item('help.license', '开源许可（MIT）'),
        separator,
        item('help.about', '关于 Npcc'),
      ],
    },
  ];
}
