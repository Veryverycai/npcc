import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';

import {
  buildSessionState,
  changeZoom,
  closeAllDocuments,
  createNewFile,
  openDroppedPaths,
  openPaths,
  restoreDocuments,
  setRecentCache,
} from '@renderer/app/actions';
import { startPluginBridge } from '@renderer/app/pluginBridge';
import { loadRecent, loadSession, saveSession } from '@renderer/app/session';
import { installShortcuts } from '@renderer/app/shortcuts';
import { applyUiTheme } from '@renderer/editor/theme';
import {
  appVersion,
  describeError,
  isTauri,
  onCloseRequested,
  onOpenPaths,
  saveState,
  setWindowTitle,
  startupPaths,
} from '@renderer/ipc';
import { useDocs } from '@renderer/store/documents';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

import { EditorPane } from '../components/EditorPane';
import { DiffPanel } from '../components/DiffPanel';
import { FindPanel } from '../components/FindPanel';
import { FindResultsPanel } from '../components/FindResultsPanel';
import { GotoLineDialog } from '../components/GotoLineDialog';
import { MenuBar } from '../components/MenuBar';
import { PluginsDialog } from '../components/PluginsDialog';
import { SearchPanel } from '../components/SearchPanel';
import { SettingsDialog } from '../components/SettingsDialog';
import { StatusBar } from '../components/StatusBar';
import { TabBar } from '../components/TabBar';
import { WelcomePane } from '../components/WelcomePane';

/** Guards the boot routine so a double-invoked effect cannot open two drafts. */
let booted = false;

export function App() {
  const docs = useDocs((state) => state.docs);
  const settings = useSettings((state) => state.settings);
  const hydrated = useSettings((state) => state.hydrated);
  const findOpen = useUi((state) => state.findOpen);
  const findResultsOpen = useUi((state) => state.findResultsOpen);
  const searchPanelOpen = useUi((state) => state.searchPanelOpen);
  const settingsOpen = useUi((state) => state.settingsOpen);
  const gotoLineOpen = useUi((state) => state.gotoLineOpen);
  const pluginsOpen = useUi((state) => state.pluginsOpen);
  const diffOpen = useUi((state) => state.diffOpen);
  const statusMessage = useUi((state) => state.statusMessage);

  const closingRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);

  // 1. Settings first: encoding/EOL defaults are needed by every later step.
  useEffect(() => {
    void useSettings.getState().hydrate();
  }, []);

  // 2. Restore the previous session once settings are available.
  useEffect(() => {
    if (!hydrated || booted) return;
    booted = true;
    void (async () => {
      setRecentCache(await loadRecent());
      const session = await loadSession();
      if (session && session.tabs.length > 0) {
        await restoreDocuments(session);
      }
      const cliPaths = await startupPaths();
      if (cliPaths.length > 0) {
        await openPaths(cliPaths);
      }
      if (useDocs.getState().docs.length === 0) {
        createNewFile();
      }
    })();
  }, [hydrated]);

  // 3. Keep the surrounding UI in sync with the editor theme.
  useEffect(() => {
    applyUiTheme(settings.theme);
  }, [settings.theme]);

  // 4. Native menu accelerators used to live in the menu bar; the bar is drawn
  // by the renderer now, so its key table is installed here.
  useEffect(() => installShortcuts(), []);

  // 5. A second instance forwards the files it was launched with.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    void onOpenPaths((paths) => {
      void openPaths(paths);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 6. Files dropped on the window open as tabs; the overlay marks the drop zone.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setDragActive(true);
          return;
        }
        setDragActive(false);
        if (event.payload.type === 'drop') {
          const paths = event.payload.paths ?? [];
          if (paths.length > 0) void openDroppedPaths(paths);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 7. Extra shortcuts that the native menu cannot express.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        const { docs: openDocs, activeId, setActive } = useDocs.getState();
        if (openDocs.length < 2) return;
        const index = openDocs.findIndex((doc) => doc.id === activeId);
        const step = event.shiftKey ? -1 : 1;
        const next = openDocs[(index + step + openDocs.length) % openDocs.length];
        setActive(next.id);
        return;
      }
      if (event.ctrlKey && event.key === ',') {
        event.preventDefault();
        useUi.getState().setSettingsOpen(true);
        return;
      }
      if (event.key === 'Escape' && useUi.getState().findOpen) {
        useUi.getState().closeFind();
        return;
      }
      if (event.key === 'Escape' && useUi.getState().findResultsOpen) {
        useUi.getState().closeFindResults();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 7b. WebView2 answers Ctrl+F with its own find bar before the menu
  // accelerator fires, so the editor panel claims the keys in the capture
  // phase. Bubble handlers stay untouched for the rest of the shortcuts.
  useEffect(() => {
    const claimFindKeys = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;
      event.preventDefault();
      event.stopPropagation();
      useUi.getState().openFind(key === 'h');
    };
    window.addEventListener('keydown', claimFindKeys, true);
    return () => window.removeEventListener('keydown', claimFindKeys, true);
  }, []);

  // 8. Ctrl+wheel zooms, matching the status bar percentage.
  useEffect(() => {
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // 9. Close guard: snapshot the session, confirm unsaved tabs, then persist.
  // The snapshot is written first so a save prompt that the user cancels -- or
  // an I/O error -- still leaves the next launch with the same tabs.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: UnlistenFn | null = null;
    let disposed = false;
    void onCloseRequested(async () => {
      if (closingRef.current) return true;
      closingRef.current = true;
      try {
        await saveSession(buildSessionState());
        const canClose = await closeAllDocuments();
        if (!canClose) {
          closingRef.current = false;
          return false;
        }
        await saveState('settings', useSettings.getState().settings);
        return true;
      } catch (error) {
        // Never trap the user inside a window whose exit guard failed.
        useUi.getState().setStatusMessage(`退出时保存失败：${describeError(error)}`);
        closingRef.current = false;
        return true;
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 10. Answer plugin windows: every call is whitelisted in pluginBridge.
  useEffect(() => {
    if (!isTauri) return undefined;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    void startPluginBridge().then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 11. Transient messages fade out on their own.
  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => useUi.getState().setStatusMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  // 12. Crash safety: dirty drafts are also persisted between exits. Untitled
  // tabs carry their text in the session, so a crash or a power cut cannot lose
  // work that was never saved to disk.
  useEffect(() => {
    if (!isTauri) return undefined;
    const timer = window.setInterval(() => {
      const dirty = useDocs.getState().docs.some((doc) => doc.dirty);
      if (!dirty) return;
      void saveSession(buildSessionState());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  // 13. The title bar carries the running version, so a screenshot in a bug
  // report is enough to tell which build it came from.
  useEffect(() => {
    void (async () => {
      const version = await appVersion();
      await setWindowTitle(version ? `Npcc ${version}` : 'Npcc');
    })();
  }, []);

  return (
    <div className="app">
      <MenuBar />
      <TabBar />
      <div className="editor-area">
        {docs.length === 0 ? <WelcomePane /> : <EditorPane />}
        {findOpen && <FindPanel />}
      </div>
      {findResultsOpen && <FindResultsPanel />}
      {searchPanelOpen && <SearchPanel />}
      {diffOpen && <DiffPanel />}
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
      {pluginsOpen && <PluginsDialog />}
      {gotoLineOpen && <GotoLineDialog />}
      {statusMessage && <div className="toast">{statusMessage}</div>}
      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            松开以打开文件
            <span className="drop-overlay-hint">可一次拖入多个文件</span>
          </div>
        </div>
      )}
    </div>
  );
}
