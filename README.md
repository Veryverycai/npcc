# Npcc

一个轻量的 Notepad++ 风格文本编辑器：Tauri 2 + React 19 + TypeScript 5 + CodeMirror 6。
Rust 侧负责全部文件系统访问、编码探测/转换、跨文件搜索与会话持久化；前端只做 UI 与编辑。

## 下载

Windows x64 安装包见 [Releases](https://github.com/Veryverycai/npcc/releases)：
`Npcc_0.1.0_x64-setup.exe`（NSIS，按当前用户安装）或 `Npcc_0.1.0_x64_en-US.msi`。

## 功能速览

- 多标签编辑：指针拖拽排序、标签右键菜单（关闭其他 / 关闭右侧 / 复制路径）、未保存脏标记。
- 8 套配色模板：默认浅色，另有深色、Monokai、Nord、Dracula、Solarized Light、Solarized Dark、高对比；
  可在「视图 → 配色模板」或设置对话框切换，选择会持久化。
- 选中任意单词时自动高亮其余相同文本（设置里可关闭），`Ctrl+Shift+L` 可直接多光标选中全部匹配。
- 文件拖入窗口即打开，带落区提示，可一次拖入多个；第二实例与命令行参数也会开成标签。
- 「文件 → 最近打开」固定 5 条，欢迎页同步展示最近文件；列表存在 `recent.json`。
- 查找面板可「本文档全部」或「打开的文档全部」，结果在编辑器下方分屏列出（可拖动边界调高），
  点击行号即跳转；菜单项为「搜索 → 在本文档 / 在所有打开文档中查找全部」（前者 `Ctrl+Shift+E`）。
- 编码探测/转换（UTF-8/BOM、GBK、GB18030、UTF-16、Latin-1）、EOL 转换、跨文件搜索、书签、宏、
  分屏镜像、文本对比、插件宿主。

## 环境要求

| 组件 | 版本 / 说明 |
| --- | --- |
| Node.js | 20+ |
| Rust | stable `x86_64-pc-windows-msvc`（`rustup` 安装） |
| MSVC Build Tools | 需勾选 "使用 C++ 的桌面开发"（含 Windows 11 SDK） |
| WebView2 Runtime | Win11 与 Win10 21H2+ 预装；缺失时先装 Edge WebView2 Runtime |

## 常用命令

```powershell
npm install                # 安装前端依赖
npm run dev:web            # 只跑 Vite（无宿主能力，纯 UI 调试）
npm test                   # Vitest 单测
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run tauri dev          # 开发模式（热更新）
npm run tauri build        # 发布构建，产物在 src-tauri/target/release/bundle/
```

### 关于 PowerShell 执行策略

本机若禁止运行脚本，`npm` / `npx` 的 `.ps1` shim 会被拦截。三种处理方式：

1. 用 `.cmd` 版本：`npm.cmd install`、`npx.cmd vitest run`（推荐，不改系统设置）；
2. 或仅对当前进程放行：`powershell -ExecutionPolicy Bypass -File .\scripts\with-msvc.ps1 ...`；
3. 或永久放行：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

### 构建时找不到 `link.exe`

`cargo` 需要 MSVC 的 `PATH`/`LIB`/`INCLUDE`，普通 PowerShell 会话里没有。
用仓库自带包装脚本即可（不需要打开 "Developer PowerShell"）：

```powershell
.\scripts\with-msvc.ps1 cargo check --manifest-path src-tauri/Cargo.toml
.\scripts\with-msvc.ps1 cargo test  --manifest-path src-tauri/Cargo.toml
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\with-msvc.ps1 npm.cmd run tauri build
```

## 目录结构

```
src/                     前端
  shared/                前后端共用的类型与常量（IPC 契约的唯一来源）
  renderer/app/          命令分发、动作层、插件 RPC 桥
  renderer/editor/       CodeMirror 扩展（语言、主题、查找、书签、宏、diff、覆盖模式…）
  renderer/components/   TabBar / EditorPane / StatusBar / 各面板与对话框
  renderer/ipc/          唯一宿主依赖层（invoke / listen 封装，便于单测 mock）
  plugin/                隔离插件窗口的宿主页
src-tauri/               Rust core
  src/commands/          对前端暴露的白名单命令
  src/services/          编码、EOL、搜索、持久化、插件扫描
  capabilities/          最小权限集（default 给主窗口，plugin 给插件窗口）
examples/hello-plugin/   声明式插件清单示例
scripts/with-msvc.ps1    带 MSVC 环境变量执行任意命令
```

## 数据与安全

- 配置文件在 `appConfigDir()`（Windows 为 `%APPDATA%\com.npcc.app`）下的 `settings.json` /
  `session.json` / `recent.json`，均带 `schemaVersion`。
- 写盘使用 "临时文件 + rename" 原子替换；可选 `.bak` 备份。
- 超大文件：>20 MB 只读预览，>50 MB 拒绝打开，>5 MB 关闭语法高亮与折叠。
- 插件窗口拥有独立 capability（无文件系统权限），只能通过事件 RPC 请求编辑器操作；
  清单为声明式（`commands` / `languages` / `themes`），不执行第三方脚本。

## 已知限制

- 首版只出 Windows x64 的 NSIS / MSI 安装包，便携版待补。
- 安装包未签名，首次运行会触发 SmartScreen 提示，需手动"仍要运行"。
- 分屏为只读镜像（内容同步、滚动与光标独立），双向编辑尚未开放。

## 许可证

[MIT](LICENSE) © 2026 Veryverycai
