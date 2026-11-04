import { useEffect } from 'react';

import {
  DEFAULT_SETTINGS,
  ENCODING_LABELS,
  ENCODING_ORDER,
  EOL_LABELS,
  EOL_ORDER,
} from '@shared/constants';
import type { Encoding, Eol } from '@shared/types';
import { THEME_ORDER, THEMES, type ThemeName } from '@renderer/editor/theme';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

const FONT_CHOICES = [
  '"Cascadia Mono", "Consolas", "Courier New", monospace',
  '"Consolas", "Courier New", monospace',
  '"Courier New", monospace',
  '"Microsoft YaHei Mono", "Microsoft YaHei", monospace',
  'monospace',
];

export function SettingsDialog() {
  const open = useUi((state) => state.settingsOpen);
  const setOpen = useUi((state) => state.setSettingsOpen);
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">设置</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            title="关闭"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <section className="settings-group">
            <h3>外观</h3>
            <label className="settings-row">
              <span>主题</span>
              <select
                value={settings.theme}
                onChange={(event) => update({ theme: event.target.value as ThemeName })}
              >
                {THEME_ORDER.map((name) => (
                  <option key={name} value={name}>
                    {THEMES[name].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>字号</span>
              <input
                type="number"
                min={8}
                max={48}
                value={settings.fontSize}
                onChange={(event) => update({ fontSize: Number(event.target.value) || 14 })}
              />
            </label>
            <label className="settings-row">
              <span>字体</span>
              <select
                value={settings.fontFamily}
                onChange={(event) => update({ fontFamily: event.target.value })}
              >
                {(FONT_CHOICES.includes(settings.fontFamily)
                  ? FONT_CHOICES
                  : [settings.fontFamily, ...FONT_CHOICES]
                ).map((font) => (
                  <option key={font} value={font}>
                    {font.split(',')[0].replaceAll('"', '')}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>自动换行</span>
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(event) => update({ wordWrap: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>显示空白字符</span>
              <input
                type="checkbox"
                checked={settings.showWhitespace}
                onChange={(event) => update({ showWhitespace: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>显示行号</span>
              <input
                type="checkbox"
                checked={settings.lineNumbers}
                onChange={(event) => update({ lineNumbers: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>高亮当前行</span>
              <input
                type="checkbox"
                checked={settings.highlightActiveLine}
                onChange={(event) => update({ highlightActiveLine: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>高亮选中文本的其他匹配</span>
              <input
                type="checkbox"
                checked={settings.highlightSelectionMatches}
                onChange={(event) =>
                  update({ highlightSelectionMatches: event.target.checked })
                }
              />
            </label>
          </section>

          <section className="settings-group">
            <h3>编辑</h3>
            <label className="settings-row">
              <span>Tab 宽度</span>
              <select
                value={settings.tabSize}
                onChange={(event) => update({ tabSize: Number(event.target.value) })}
              >
                {[2, 4, 8].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>用空格代替 Tab</span>
              <input
                type="checkbox"
                checked={settings.insertSpaces}
                onChange={(event) => update({ insertSpaces: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>自动闭合括号</span>
              <input
                type="checkbox"
                checked={settings.autoCloseBrackets}
                onChange={(event) => update({ autoCloseBrackets: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>默认编码</span>
              <select
                value={settings.encoding}
                onChange={(event) => update({ encoding: event.target.value as Encoding })}
              >
                {ENCODING_ORDER.map((encoding) => (
                  <option key={encoding} value={encoding}>
                    {ENCODING_LABELS[encoding]}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <span>默认换行符</span>
              <select
                value={settings.eol}
                onChange={(event) => update({ eol: event.target.value as Eol })}
              >
                {EOL_ORDER.map((eol) => (
                  <option key={eol} value={eol}>
                    {EOL_LABELS[eol]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-group">
            <h3>文件与搜索</h3>
            <label className="settings-row">
              <span>最近文件数</span>
              <input
                type="number"
                min={5}
                max={50}
                value={settings.recentLimit}
                onChange={(event) => update({ recentLimit: Number(event.target.value) || 15 })}
              />
            </label>
            <label className="settings-row">
              <span>大文件阈值 (MB)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={Math.round(settings.largeFileWarnBytes / (1024 * 1024))}
                onChange={(event) =>
                  update({
                    largeFileWarnBytes: (Number(event.target.value) || 20) * 1024 * 1024,
                  })
                }
              />
            </label>
            <label className="settings-row settings-row-wide">
              <span>搜索默认忽略</span>
              <input
                value={settings.searchExclude}
                onChange={(event) => update({ searchExclude: event.target.value })}
              />
            </label>
          </section>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="text-button"
            onClick={() => update({ ...DEFAULT_SETTINGS })}
          >
            恢复默认
          </button>
          <span className="panel-spacer" />
          <button type="button" className="text-button primary" onClick={() => setOpen(false)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
