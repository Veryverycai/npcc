import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { useUi } from '@renderer/store/ui';

/**
 * Overwrite (INS/OVR) mode: typing replaces the character under the cursor
 * instead of pushing it right. The mode is app state rather than editor state,
 * because a single EditorView hosts every tab and `setState` would reset it.
 */
export function toggleOverwrite(): void {
  const ui = useUi.getState();
  const next = !ui.overwrite;
  ui.setOverwrite(next);
  ui.setStatusMessage(next ? '已切换到覆盖模式 (OVR)' : '已切换到插入模式 (INS)');
}

function typeOver(view: EditorView, from: number, to: number, text: string): boolean {
  if (!useUi.getState().overwrite) return false;
  if (from !== to || text.length === 0) return false;
  const line = view.state.doc.lineAt(from);
  const room = line.to - from;
  if (room <= 0) return false;
  const remove = Math.min(room, text.length);
  view.dispatch({
    changes: { from, to: from + remove, insert: text },
    selection: { anchor: from + text.length },
    userEvent: 'input.type',
    scrollIntoView: true,
  });
  return true;
}

export function overwriteExtension(): Extension {
  return [
    EditorView.inputHandler.of((view, from, to, text) => typeOver(view, from, to, text)),
    keymap.of([
      {
        key: 'Insert',
        run: () => {
          toggleOverwrite();
          return true;
        },
      },
    ]),
  ];
}
