import { useEffect, useState } from 'react';

import type { PluginManifest } from '@shared/types';
import { loadPlugins } from '@renderer/app/pluginBridge';
import { configDir, describeError, openPluginWindow, showMessage } from '@renderer/ipc';
import { useUi } from '@renderer/store/ui';

/**
 * Plugin manager. It only lists manifests found under
 * `<appConfig>/plugins/<id>/plugin.json`; activating one opens an isolated
 * window (see `capabilities/plugin.json`).
 */
export function PluginsDialog() {
  const open = useUi((state) => state.pluginsOpen);
  const setOpen = useUi((state) => state.setPluginsOpen);

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
        aria-label="插件"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">插件</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            title="关闭"
          >
            ×
          </button>
        </div>
        <PluginList />
      </div>
    </div>
  );
}

function PluginList() {
  const [plugins, setPlugins] = useState<PluginManifest[] | null>(null);
  const [root, setRoot] = useState<string>('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    void loadPlugins(true).then((list) => {
      if (!disposed) setPlugins(list);
    });
    void configDir().then((dir) => {
      if (!disposed) setRoot(dir);
    });
    return () => {
      disposed = true;
    };
  }, [revision]);

  const activate = (plugin: PluginManifest): void => {
    void openPluginWindow(plugin.id).catch((error) => {
      void showMessage(describeError(error), '插件启动失败');
    });
  };

  return (
    <>
      <div className="modal-body plugins-body">
        <p className="plugins-hint">
          插件放在{' '}
          <code>{root ? `${root}\\plugins\\&lt;id&gt;` : '<应用配置目录>\\plugins\\<id>'}</code>
          ，目录内提供 <code>plugin.json</code>（id / name / version / main / contributes）。
          插件窗口运行在独立 webview 中，仅能通过白名单 RPC 访问编辑器，不具备文件系统权限。
        </p>

        {plugins === null && <p className="plugins-hint">正在读取插件目录…</p>}
        {plugins !== null && plugins.length === 0 && (
          <p className="plugins-hint">未发现插件。新建插件目录后点「刷新」即可。</p>
        )}

        <div className="plugins-list">
          {plugins?.map((plugin) => {
            const commands = plugin.contributes?.commands ?? [];
            const languages = plugin.contributes?.languages ?? [];
            const themes = plugin.contributes?.themes ?? [];
            return (
              <div key={plugin.id} className="plugins-row">
                <div className="plugins-row-main">
                  <span className="plugins-name">{plugin.name}</span>
                  <span className="plugins-meta">
                    {plugin.id} · v{plugin.version} · 命令 {commands.length} · 语言{' '}
                    {languages.length} · 主题 {themes.length}
                  </span>
                  <span className="plugins-path" title={plugin.dir}>
                    {plugin.dir}
                  </span>
                </div>
                <button type="button" className="panel-button" onClick={() => activate(plugin)}>
                  打开
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="panel-button"
          onClick={() => setRevision((value) => value + 1)}
        >
          刷新
        </button>
        <span className="panel-spacer" />
      </div>
    </>
  );
}
