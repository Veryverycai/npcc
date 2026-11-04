import { runCommand } from '@renderer/app/commands';

/**
 * Shortcuts that used to come from the native menu accelerators. The menu bar
 * is now drawn in the DOM, so the key table has to live here as well.
 *
 * Keys already claimed by CodeMirror (Ctrl-Z, Ctrl-A, Ctrl-F2, ...) or by the
 * App-level handlers (Ctrl-F/H/,) are intentionally absent: the editor calls
 * `preventDefault` on them and this table would run the command twice.
 */
const KEY_COMMANDS: Record<string, string> = {
  'ctrl+n': 'file.new',
  'ctrl+o': 'file.open',
  'ctrl+s': 'file.save',
  'ctrl+shift+s': 'file.saveAs',
  'ctrl+w': 'file.close',
  'ctrl+g': 'search.gotoLine',
  'ctrl+shift+f': 'search.findInFiles',
  'ctrl+shift+e': 'search.findAllInFile',
  'ctrl+d': 'edit.duplicateLine',
  'ctrl+l': 'edit.deleteLine',
  'ctrl+q': 'edit.toggleComment',
  'alt+arrowup': 'edit.moveLineUp',
  'alt+arrowdown': 'edit.moveLineDown',
  'ctrl+=': 'view.zoomIn',
  'ctrl+-': 'view.zoomOut',
  'ctrl+0': 'view.zoomReset',
  'ctrl+shift+r': 'macro.record',
  'ctrl+shift+p': 'macro.play',
  f11: 'view.fullscreen',
};

/** Normalises a keydown into `ctrl+shift+key` form. */
export function shortcutOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  let key = event.key.toLowerCase();
  // Shift only matters for letters; for symbols the shifted glyph already
  // identifies the key (Shift+"=" arrives as "+"), so it is dropped there.
  if (event.shiftKey && key.length === 1 && key >= 'a' && key <= 'z') parts.push('shift');
  if (key === '+') key = '=';
  parts.push(key);
  return parts.join('+');
}

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function installShortcuts(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.defaultPrevented) return;
    if (!event.ctrlKey && !event.altKey) {
      // Only F11 reaches this point; let every other plain key through.
      if (event.key !== 'F11') return;
    }
    const target = event.target as HTMLElement | null;
    // Inside the find panel or a dialog the field keeps its own editing keys.
    if (target && FORM_TAGS.has(target.tagName)) return;

    const commandId = KEY_COMMANDS[shortcutOf(event)];
    if (!commandId) return;
    event.preventDefault();
    event.stopPropagation();
    void runCommand(commandId);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
