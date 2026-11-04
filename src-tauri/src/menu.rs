use std::sync::Mutex;

use tauri::menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Wry};

/// How many "recently opened" slots the File menu exposes.
pub const RECENT_SLOTS: usize = 5;

/// Handles kept alive so `set_recent_files` can relabel the slots at runtime.
pub struct RecentMenuState(pub Mutex<Vec<MenuItem<Wry>>>);

/// The native menu only forwards command ids; every action lives in the
/// renderer, which keeps a single implementation of each command.
fn item(app: &AppHandle, id: &str, label: &str, accelerator: &str) -> tauri::Result<MenuItem<Wry>> {
    let mut builder = MenuItemBuilder::with_id(id, label);
    if !accelerator.is_empty() {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

/// Ids must stay in sync with `THEME_ORDER` in `renderer/editor/theme.ts`.
const THEME_ITEMS: [(&str, &str); 8] = [
    ("light", "浅色"),
    ("dark", "深色"),
    ("monokai", "Monokai"),
    ("nord", "Nord"),
    ("dracula", "Dracula"),
    ("solarized-light", "Solarized Light"),
    ("solarized-dark", "Solarized Dark"),
    ("contrast", "高对比"),
];

pub fn build(app: &AppHandle) -> tauri::Result<(Menu<Wry>, RecentMenuState)> {
    // Slots exist from the start so the renderer can only relabel them.
    let mut recent_slots = Vec::with_capacity(RECENT_SLOTS);
    for slot in 0..RECENT_SLOTS {
        recent_slots.push(
            MenuItemBuilder::with_id(format!("recent.{slot}"), "（空）")
                .enabled(false)
                .build(app)?,
        );
    }
    let mut recent_builder = SubmenuBuilder::new(app, "最近打开");
    for slot in &recent_slots {
        recent_builder = recent_builder.item(slot);
    }
    let recent = recent_builder.build()?;

    let file = SubmenuBuilder::new(app, "文件")
        .item(&item(app, "file.new", "新建", "CmdOrCtrl+N")?)
        .item(&item(app, "file.open", "打开...", "CmdOrCtrl+O")?)
        .item(&item(app, "file.openFolder", "打开文件夹...", "")?)
        .item(&recent)
        .separator()
        .item(&item(app, "file.save", "保存", "CmdOrCtrl+S")?)
        .item(&item(app, "file.saveAs", "另存为...", "CmdOrCtrl+Shift+S")?)
        .separator()
        .item(&item(app, "file.close", "关闭标签", "CmdOrCtrl+W")?)
        .item(&item(app, "file.closeAll", "关闭全部", "")?)
        .separator()
        .item(&item(app, "file.reveal", "在资源管理器中显示", "")?)
        .separator()
        .item(&item(app, "app.exit", "退出", "")?)
        .build()?;

    let edit = SubmenuBuilder::new(app, "编辑")
        .item(&item(app, "edit.undo", "撤销", "CmdOrCtrl+Z")?)
        .item(&item(app, "edit.redo", "重做", "CmdOrCtrl+Y")?)
        .separator()
        .item(&item(app, "edit.cut", "剪切", "CmdOrCtrl+X")?)
        .item(&item(app, "edit.copy", "复制", "CmdOrCtrl+C")?)
        .item(&item(app, "edit.paste", "粘贴", "CmdOrCtrl+V")?)
        .item(&item(app, "edit.selectAll", "全选", "CmdOrCtrl+A")?)
        .separator()
        .item(&item(
            app,
            "edit.duplicateLine",
            "复制当前行",
            "CmdOrCtrl+D",
        )?)
        .item(&item(app, "edit.deleteLine", "删除当前行", "CmdOrCtrl+L")?)
        .item(&item(app, "edit.moveLineUp", "上移当前行", "Alt+Up")?)
        .item(&item(app, "edit.moveLineDown", "下移当前行", "Alt+Down")?)
        .item(&item(
            app,
            "edit.toggleComment",
            "切换行注释",
            "CmdOrCtrl+Q",
        )?)
        .separator()
        .item(&item(app, "edit.toggleOverwrite", "覆盖模式", "")?)
        .item(&item(
            app,
            "edit.selectAllMatches",
            "选中全部相同文本",
            "CmdOrCtrl+Shift+L",
        )?)
        .build()?;

    let search = SubmenuBuilder::new(app, "搜索")
        .item(&item(app, "search.find", "查找", "CmdOrCtrl+F")?)
        .item(&item(app, "search.replace", "替换", "CmdOrCtrl+H")?)
        .item(&item(
            app,
            "search.findInFiles",
            "在文件夹中查找",
            "CmdOrCtrl+Shift+F",
        )?)
        .separator()
        .item(&item(
            app,
            "search.findAllInFile",
            "在本文档中查找全部",
            "CmdOrCtrl+Shift+E",
        )?)
        .item(&item(
            app,
            "search.findAllInOpen",
            "在所有打开文档中查找全部",
            "",
        )?)
        .separator()
        .item(&item(app, "search.gotoLine", "转到行...", "CmdOrCtrl+G")?)
        .separator()
        .item(&item(app, "bookmark.toggle", "切换书签", "CmdOrCtrl+F2")?)
        .item(&item(app, "bookmark.next", "下一个书签", "F2")?)
        .item(&item(app, "bookmark.prev", "上一个书签", "Shift+F2")?)
        .build()?;

    let mut theme_builder = SubmenuBuilder::new(app, "配色模板");
    for (id, label) in THEME_ITEMS {
        theme_builder = theme_builder.item(&item(app, &format!("view.theme.{id}"), label, "")?);
    }
    let themes = theme_builder
        .separator()
        .item(&item(app, "view.cycleTheme", "下一个模板", "")?)
        .build()?;

    let view = SubmenuBuilder::new(app, "视图")
        .item(&item(app, "view.zoomIn", "放大", "CmdOrCtrl+=")?)
        .item(&item(app, "view.zoomOut", "缩小", "CmdOrCtrl+-")?)
        .item(&item(app, "view.zoomReset", "重置缩放", "CmdOrCtrl+0")?)
        .separator()
        .item(&item(app, "view.toggleWordWrap", "自动换行", "")?)
        .item(&item(app, "view.toggleWhitespace", "显示空白字符", "")?)
        .item(&item(app, "view.toggleLineNumbers", "显示行号", "")?)
        .item(&themes)
        .separator()
        .item(&item(app, "view.splitVertical", "左右分屏", "")?)
        .item(&item(app, "view.splitHorizontal", "上下分屏", "")?)
        .item(&item(app, "view.splitNone", "取消分屏", "")?)
        .item(&item(app, "view.compare", "与另一标签对比...", "")?)
        .separator()
        .item(&item(app, "view.fullscreen", "全屏", "F11")?)
        .build()?;

    // Ids must stay in sync with `renderer/editor/languages.ts`.
    const LANGUAGE_ITEMS: [(&str, &str); 20] = [
        ("plaintext", "纯文本"),
        ("c", "C/C++"),
        ("java", "Java"),
        ("python", "Python"),
        ("javascript", "JavaScript"),
        ("typescript", "TypeScript"),
        ("json", "JSON"),
        ("html", "HTML"),
        ("css", "CSS"),
        ("xml", "XML"),
        ("sql", "SQL"),
        ("markdown", "Markdown"),
        ("rust", "Rust"),
        ("go", "Go"),
        ("php", "PHP"),
        ("shell", "Shell"),
        ("powershell", "PowerShell"),
        ("ini", "INI/Properties"),
        ("toml", "TOML"),
        ("yaml", "YAML"),
    ];

    let mut language_builder = SubmenuBuilder::new(app, "语言");
    for (id, label) in LANGUAGE_ITEMS {
        language_builder = language_builder.item(&item(app, &format!("language.{id}"), label, "")?);
    }
    let language = language_builder.build()?;

    let encoding = SubmenuBuilder::new(app, "编码")
        .item(&item(app, "encoding.utf8", "转为 UTF-8", "")?)
        .item(&item(app, "encoding.utf8bom", "转为 UTF-8 BOM", "")?)
        .item(&item(app, "encoding.gbk", "转为 GBK", "")?)
        .item(&item(app, "encoding.gb18030", "转为 GB18030", "")?)
        .item(&item(app, "encoding.utf16le", "转为 UTF-16 LE", "")?)
        .item(&item(app, "encoding.latin1", "转为 ISO-8859-1", "")?)
        .separator()
        .item(&item(app, "eol.lf", "转为 LF", "")?)
        .item(&item(app, "eol.crlf", "转为 CRLF", "")?)
        .item(&item(app, "eol.cr", "转为 CR", "")?)
        .separator()
        .item(&item(app, "reopen.utf8", "以 UTF-8 重新打开", "")?)
        .item(&item(app, "reopen.gbk", "以 GBK 重新打开", "")?)
        .item(&item(app, "reopen.gb18030", "以 GB18030 重新打开", "")?)
        .item(&item(app, "reopen.utf16le", "以 UTF-16 LE 重新打开", "")?)
        .item(&item(app, "reopen.latin1", "以 ISO-8859-1 重新打开", "")?)
        .build()?;

    let help = SubmenuBuilder::new(app, "帮助")
        .item(&item(app, "help.about", "关于 Npcc", "")?)
        .build()?;

    let macro_menu = SubmenuBuilder::new(app, "宏")
        .item(&item(
            app,
            "macro.record",
            "开始/结束录制",
            "CmdOrCtrl+Shift+R",
        )?)
        .item(&item(app, "macro.play", "回放宏", "CmdOrCtrl+Shift+P")?)
        .separator()
        .item(&item(app, "macro.clear", "清空宏", "")?)
        .build()?;

    let plugin = SubmenuBuilder::new(app, "插件")
        .item(&item(app, "plugin.manage", "插件列表...", "")?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &file,
            &edit,
            &search,
            &view,
            &language,
            &encoding,
            &macro_menu,
            &plugin,
            &help,
        ])
        .build()?;
    Ok((menu, RecentMenuState(Mutex::new(recent_slots))))
}
