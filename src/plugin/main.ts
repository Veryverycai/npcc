import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { PluginManifest, PluginRpcReply, PluginRpcRequest } from '@shared/types';

/**
 * Plugin host page. It lives in its own webview (label `plugin-<id>`) with a
 * dedicated capability that grants events only, so every capability it uses is
 * a whitelisted RPC handled by the main window.
 */
const pluginId = new URLSearchParams(location.search).get('id') ?? '';
const windowLabel = getCurrentWindow().label;

let sequence = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

async function call<T>(method: string, args?: unknown): Promise<T> {
  const requestId = (sequence += 1);
  const request: PluginRpcRequest = { requestId, pluginId, windowLabel, method, args };
  const promise = new Promise<unknown>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
  });
  await emitTo('main', 'plugin://rpc', request);
  return (await promise) as T;
}

function log(line: string): void {
  const host = document.getElementById('plugin-log');
  if (!host) return;
  const stamp = new Date().toLocaleTimeString('zh-CN');
  host.textContent = `[${stamp}] ${line}\n${host.textContent ?? ''}`.slice(0, 8000);
}

function escapeText(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function render(manifest: PluginManifest): void {
  const commands = manifest.contributes?.commands ?? [];
  const languages = manifest.contributes?.languages ?? [];
  const themes = manifest.contributes?.themes ?? [];

  const root = document.getElementById('plugin-root');
  if (!root) return;
  root.innerHTML = `
    <h1>${escapeText(manifest.name)}</h1>
    <section>
      <h2>插件信息</h2>
      <dl>
        <dt>标识</dt><dd>${escapeText(manifest.id)}</dd>
        <dt>版本</dt><dd>${escapeText(manifest.version)}</dd>
        <dt>入口</dt><dd>${escapeText(manifest.main ?? '（声明式，无脚本）')}</dd>
        <dt>目录</dt><dd>${escapeText(manifest.dir)}</dd>
      </dl>
    </section>
    <section>
      <h2>声明式贡献</h2>
      ${
        commands.length === 0 && languages.length === 0 && themes.length === 0
          ? '<p class="muted">此插件未声明贡献项。</p>'
          : `<ul>
              ${commands.map((item) => `<li>命令：${escapeText(item.title)} → ${escapeText(item.command)}</li>`).join('')}
              ${languages.map((item) => `<li>语言：${escapeText(item.language)} (${escapeText(item.extensions.join(', '))})</li>`).join('')}
              ${themes.map((item) => `<li>主题：${escapeText(item)}</li>`).join('')}
            </ul>`
      }
    </section>
    <section>
      <h2>RPC 演示（隔离窗口 → 主界面）</h2>
      <button type="button" id="btn-text">读取当前文档</button>
      <button type="button" id="btn-insert">插入时间戳</button>
      <button type="button" id="btn-selection">读取选区</button>
      <pre id="plugin-log" class="muted">等待操作…</pre>
    </section>
  `;

  document.getElementById('btn-text')?.addEventListener('click', () => {
    void (async () => {
      try {
        const text = await call<string>('editor.getText');
        log(`editor.getText → ${text.length} 个字符\n${text.slice(0, 400)}`);
      } catch (error) {
        log(`editor.getText 失败：${String(error)}`);
      }
    })();
  });

  document.getElementById('btn-insert')?.addEventListener('click', () => {
    void (async () => {
      try {
        await call('editor.insertText', { text: `[${new Date().toISOString()}]` });
        log('editor.insertText → 已插入时间戳');
      } catch (error) {
        log(`editor.insertText 失败：${String(error)}`);
      }
    })();
  });

  document.getElementById('btn-selection')?.addEventListener('click', () => {
    void (async () => {
      try {
        const text = await call<string>('editor.getSelection');
        log(text.length === 0 ? '当前没有选中文本' : `选区内容：\n${text}`);
      } catch (error) {
        log(`editor.getSelection 失败：${String(error)}`);
      }
    })();
  });
}

async function boot(): Promise<void> {
  await listen<PluginRpcReply>('plugin://reply', (event) => {
    const entry = pending.get(event.payload.requestId);
    if (!entry) return;
    pending.delete(event.payload.requestId);
    if (event.payload.ok) entry.resolve(event.payload.value);
    else entry.reject(new Error(event.payload.error ?? '插件请求失败'));
  });

  if (!pluginId) {
    const root = document.getElementById('plugin-root');
    if (root)
      root.innerHTML = '<h1>缺少插件标识</h1><p class="muted">请从 Npcc 的插件列表打开。</p>';
    return;
  }

  try {
    render(await call<PluginManifest>('plugin.manifest'));
  } catch (error) {
    const root = document.getElementById('plugin-root');
    if (root)
      root.innerHTML = `<h1>插件加载失败</h1><p class="muted">${escapeText(String(error))}</p>`;
  }
}

void boot();
