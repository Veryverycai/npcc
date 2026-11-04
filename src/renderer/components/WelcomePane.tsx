import { useEffect, useState } from 'react';

import type { RecentEntry } from '@shared/types';
import { createNewFile, openPath, openViaDialog } from '@renderer/app/actions';
import { fileExists, isTauri, showMessage } from '@renderer/ipc';
import { loadRecent } from '@renderer/app/session';

/** Shown when no tab is open: quick actions plus the recent file list. */
export function WelcomePane() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [missing, setMissing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadRecent();
      if (cancelled) return;
      setEntries(list);
      if (!isTauri || list.length === 0) return;
      const flags: Record<string, boolean> = {};
      for (const entry of list) {
        try {
          flags[entry.path] = !(await fileExists(entry.path));
        } catch {
          flags[entry.path] = false;
        }
      }
      if (!cancelled) setMissing(flags);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1 className="welcome-title">Npcc</h1>
        <p className="welcome-subtitle">轻量文本编辑器 · Tauri + CodeMirror 6</p>

        <div className="welcome-actions">
          <button type="button" className="welcome-action" onClick={createNewFile}>
            <span className="welcome-action-title">新建文件</span>
            <span className="welcome-shortcut">Ctrl+N</span>
          </button>
          <button type="button" className="welcome-action" onClick={() => void openViaDialog()}>
            <span className="welcome-action-title">打开文件…</span>
            <span className="welcome-shortcut">Ctrl+O</span>
          </button>
        </div>

        <div className="welcome-recent">
          <div className="welcome-recent-title">最近打开</div>
          {entries.length === 0 ? (
            <div className="welcome-empty">还没有最近文件。也可以把文件直接拖进窗口。</div>
          ) : (
            <ul className="welcome-list">
              {entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    className={`welcome-item${missing[entry.path] ? ' is-missing' : ''}`}
                    title={entry.path}
                    onClick={() => {
                      if (missing[entry.path]) {
                        void showMessage(`文件已被移动或删除：\n${entry.path}`, '无法打开');
                        return;
                      }
                      void openPath(entry.path);
                    }}
                  >
                    <span className="welcome-item-name">{entry.name}</span>
                    <span className="welcome-item-path">{entry.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
