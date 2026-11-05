# Npcc

一个轻量的 Notepad++ 风格文本编辑器：Tauri 2 + React 19 + TypeScript 5 + CodeMirror 6。
Rust 侧负责全部文件系统访问、编码探测/转换、跨文件搜索与会话持久化；前端只做 UI 与编辑。

## 下载

Windows x64 安装包见 [Releases](https://github.com/Veryverycai/npcc/releases)：
`Npcc_0.1.6_x64-setup.exe`（NSIS，按当前用户安装）或 `Npcc_0.1.6_x64_en-US.msi`。

## 安装、升级与卸载

- NSIS 安装包按当前用户装到 `%LOCALAPPDATA%\Npcc`，不需要管理员权限。
- 升级先把正在运行的实例关掉（`NSIS_HOOK_PREINSTALL` 里的 RestartManager，静默安装直接结束
  进程），再跑旧 `uninstall.exe /S _?=$INSTDIR /NPCC_UPGRADE`，最后清空旧目录。顺序不能换：
  正在运行的 `npcc.exe` 删不掉，不先关进程，卸载会静默失败，快捷方式继续指向旧版本。
- 清完目录会检查 `npcc.exe` 是否真的没了，还在就报错终止安装，而不是把旧 exe 再装一遍
  （「装了新版，跑起来还是旧版」就是这么来的）。`/NPCC_UPGRADE` 只是告诉卸载器「这是升级，
  别动 WebView2 缓存」。
- 用户数据（`settings.json` / `session.json` / `recent.json`）在 `%APPDATA%\com.npcc.app`，
  不在安装目录里，升级不会丢。MSI 走 WiX 的 `MajorUpgrade`，同样会替换旧文件。
- 卸载（NSIS）会清掉安装目录、开始菜单与桌面快捷方式、控制面板条目，以及
  `%LOCALAPPDATA%\com.npcc.app`（WebView2 缓存，几百个文件）、`HKCU\Software\Npcc`
  （安装位置与安装语言）这些原版脚本不管的尾巴。
- 只有 `%APPDATA%\com.npcc.app` 会保留，它装的是设置、会话和未命名草稿。要连它一起清，用交互式
  卸载并勾上「删除应用数据」；静默卸载（`/S`）没人可问，按保留处理。MSI 卸载不清 WebView2
  缓存，需要时手动删 `%LOCALAPPDATA%\com.npcc.app`。

## 功能速览

- 多标签编辑：指针拖拽排序、标签右键菜单（关闭其他 / 关闭右侧 / 复制路径）、未保存脏标记。
- 8 套配色模板：默认浅色，另有深色、Monokai、Nord、Dracula、Solarized Light、Solarized Dark、高对比；
  可在「视图 → 配色模板」或设置对话框切换，选择会持久化。
- 选中任意单词时自动高亮其余相同文本（设置里可关闭），`Ctrl+Shift+L` 可直接多光标选中全部匹配。
- 文件拖入窗口即打开，带落区提示，可一次拖入多个；第二实例与命令行参数也会开成标签。
- 关闭窗口即保存会话（含未命名草稿），下次启动恢复上次的标签、光标与活动文档。
- 选中文字可直接拖到文档内别的行；菜单栏由渲染层绘制，跟随当前配色模板。
- 三击选整行只取行内文字，行尾用于对齐的空白和换行不会被选进来，复制出来的就是干净的一行；
  空白行三击选的是换行符，直接按删除即可清掉该行。
- 标题栏显示运行版本（`Npcc 0.1.6`），「帮助 → 关于」读的是同一个运行时版本，报 bug 截图即可看出是哪个构建。
- 「文件 → 最近打开」默认列 5 条（设置里可调到 50），欢迎页同步展示最近文件；列表存在 `recent.json`。
- 查找面板可「本文档全部」或「打开的文档全部」，结果在编辑器下方分屏列出（可拖动边界调高），
  点击行号即跳转；菜单项为「搜索 → 在本文档 / 在所有打开文档中查找全部」（前者 `Ctrl+Shift+E`）。
- 编码探测/转换（UTF-8/BOM、GBK、GB18030、UTF-16、Latin-1）、EOL 转换、跨文件搜索、书签、宏、
  分屏镜像、文本对比、插件宿主。

## 环境要求

| 组件             | 版本 / 说明                                                 |
| ---------------- | ----------------------------------------------------------- |
| Node.js          | 20+                                                         |
| Rust             | stable `x86_64-pc-windows-msvc`（`rustup` 安装）            |
| MSVC Build Tools | 需勾选 "使用 C++ 的桌面开发"（含 Windows 11 SDK）           |
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

## 代码签名

```powershell
.\scripts\sign-build.ps1                    # 构建 + 签名 + 校验
.\scripts\sign-build.ps1 -SkipBuild         # 只签已有产物
.\scripts\sign-build.ps1 -SkipBuild -Trust  # 再把证书装进本机信任存储
```

脚本会定位 Windows SDK 的 `signtool.exe`，复用或新建一张 `CN=Veryverycai, O=Npcc, C=CN`
的自签名代码签名证书（私钥只留在当前用户证书存储，不入库），把公钥导出到
`certs/npcc-selfsigned.cer`，再通过 `--config` 把指纹交给 Tauri，让 `npcc.exe`、NSIS setup 与
MSI 在打包时一并签名，最后逐个校验。

### 让本机彻底信任

`-Trust` 会把公钥装进当前用户的「受信任的根证书颁发机构」和「受信任的发布者」两个存储
（`certutil -user -addstore`，逐用户、不需要管理员权限）。之后验签结果从 `UnknownError`
变成 `Valid`，`signtool verify /pa` 也能通过，UAC 和安全属性里显示的是发布者名称而不是
「未知发布者」。

边界（很重要）：

- 只影响当前 Windows 账户。其它账户、其它机器要各自执行一次，或由管理员装进
  `LocalMachine\Root`（需要提权）。
- SmartScreen 看的是微软侧的信誉积分，不是本机信任。签名能保证的是“文件未被篡改 + 发布者可
  识别”，但新证书首次运行仍可能被拦，提示“仍要运行”。
- 私钥以可导出状态存在证书存储里（CI 需要），拿到它的人就能冒充这个发布者。因此这套做法只
  适合自用与局域网分发；面向公众分发仍应购买受信任的代码签名证书，用 `-Subject` 指定即可，
  脚本其余部分不用改。

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
  icons/                 应用图标（npcc1024.png 是母版，其余由它生成）
examples/hello-plugin/   声明式插件清单示例
scripts/with-msvc.ps1    带 MSVC 环境变量执行任意命令
```

图标全部由 `src-tauri/icons/npcc1024.png` 生成，换图后重跑一次即可（会重写
`icon.ico` / `icon.icns` / 各尺寸 PNG，`npcc.exe`、安装包与 MSI 在下次构建时跟着换）：

```powershell
npx.cmd tauri icon src-tauri/icons/npcc1024.png -o src-tauri/icons
```

## 数据与安全

- 配置文件在 `appConfigDir()`（Windows 为 `%APPDATA%\com.npcc.app`）下的 `settings.json` /
  `session.json` / `recent.json`，均带 `schemaVersion`。
- 关闭窗口时先把会话写入 `session.json` 再退出，启动时还原标签、光标与未命名草稿。
- 写盘使用 "临时文件 + rename" 原子替换；`设置 → 文件与搜索 → 保存时保留 .bak 备份` 默认关闭，
  打开后每次保存会把上一版内容复制成同目录的 `<文件名>.bak`（只保留一代）。
- 超大文件：>20 MB 只读预览，>50 MB 拒绝打开，>5 MB 关闭语法高亮与折叠。
- 插件窗口拥有独立 capability（无文件系统权限），只能通过事件 RPC 请求编辑器操作；
  清单为声明式（`commands` / `languages` / `themes`），不执行第三方脚本。

## 已知限制

- 首版只出 Windows x64 的 NSIS / MSI 安装包，便携版待补。
- 安装包用仓库脚本生成的自签名证书签名。跑过 `-Trust` 的机器上发布者显示正常，但 SmartScreen
  仍按微软侧信誉决定是否拦截；面向公众分发建议换受信任证书（见上一节）。
- 分屏为只读镜像（内容同步、滚动与光标独立），双向编辑尚未开放。

## 许可证

[MIT](LICENSE) © 2026 Veryverycai
