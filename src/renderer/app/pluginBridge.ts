import { EditorSelection } from '@codemirror/state';

import type { PluginManifest, PluginRpcRequest } from '@shared/types';
import { documentText } from '@renderer/app/actions';
import { runCommand } from '@renderer/app/commands';
import { getActiveView } from '@renderer/editor/stateRegistry';
import {
  describeError,
  listPlugins,
  onPluginRpc,
  replyToPlugin,
  showMessage,
} from '@renderer/ipc';
import { useDocs } from '@renderer/store/documents';

let cache: PluginManifest[] | null = null;

/** Cached so a plugin dialog and the RPC bridge share one scan. */
export async function loadPlugins(force = false): Promise<PluginManifest[]> {
  if (!cache || force) {
    try {
      cache = await listPlugins();
    } catch (error) {
      cache = [];
      await showMessage(describeError(error), '插件列表读取失败');
    }
  }
  return cache;
}

function activeText(): string {
  const docId = useDocs.getState().activeId;
  return docId ? documentText(docId) : '';
}

function activeSelection(): string {
  const view = getActiveView();
  if (!view) return '';
  const { from, to } = view.state.selection.main;
  return view.state.sliceDoc(from, to);
}

function insertText(text: string): boolean {
  const view = getActiveView();
  if (!view) throw new Error('没有打开的编辑器');
  view.dispatch({
    changes: {
      from: view.state.selection.main.from,
      to: view.state.selection.main.to,
      insert: text,
    },
    selection: EditorSelection.cursor(view.state.selection.main.from + text.length),
  });
  return true;
}

/**
 * Everything a plugin window is allowed to do. Nothing is implicit: each call
 * arrives as an event carrying the plugin id, and the id must own whatever the
 * call touches (commands are checked against the plugin's own contributions).
 */
async function handle(request: PluginRpcRequest): Promise<unknown> {
  const plugins = await loadPlugins();
  const plugin = plugins.find((item) => item.id === request.pluginId);
  if (!plugin) throw new Error(`未找到插件 ${request.pluginId}`);

  const args = (request.args ?? {}) as { text?: string; title?: string; id?: string };

  switch (request.method) {
    case 'plugin.manifest':
      return plugin;
    case 'plugin.runCommand': {
      const commandId = String(args.id ?? '');
      const declared = plugin.contributes?.commands ?? [];
      if (!declared.some((item) => item.id === commandId || item.command === commandId)) {
        throw new Error(`命令 ${commandId} 未在插件清单中声明`);
      }
      await runCommand(commandId);
      return true;
    }
    case 'editor.getText':
      return activeText();
    case 'editor.getSelection':
      return activeSelection();
    case 'editor.insertText':
      return insertText(String(args.text ?? ''));
    case 'editor.replaceSelection': {
      const view = getActiveView();
      if (!view) throw new Error('没有打开的编辑器');
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: String(args.text ?? '') } });
      return true;
    }
    case 'ui.showMessage':
      await showMessage(String(args.text ?? ''), args.title ?? plugin.name);
      return true;
    default:
      throw new Error(`不支持的插件调用 ${request.method}`);
  }
}

/** Starts answering plugin windows; returns the unlisten handle. */
export async function startPluginBridge(): Promise<() => void> {
  const unlisten = await onPluginRpc((request) => {
    void (async () => {
      try {
        const value = await handle(request);
        await replyToPlugin(request.windowLabel, {
          requestId: request.requestId,
          ok: true,
          value,
        });
      } catch (error) {
        await replyToPlugin(request.windowLabel, {
          requestId: request.requestId,
          ok: false,
          error: describeError(error),
        });
      }
    })();
  });
  return unlisten;
}
