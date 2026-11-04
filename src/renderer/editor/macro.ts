import { EditorSelection } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';

import { useMacro } from '@renderer/store/macro';
import { useUi } from '@renderer/store/ui';

/**
 * Captures one editing transaction while recording. Only plain change data is
 * kept, which is enough to replay typing, deletions and pastes.
 */
export function recordStep(update: ViewUpdate): void {
  const macro = useMacro.getState();
  if (!macro.recording || !update.docChanged) return;
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  update.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    changes.push({ from, to, insert: inserted.toString() });
  });
  if (changes.length === 0) return;
  macro.addStep({
    changes,
    selection: update.state.selection.ranges.map((range) => ({
      anchor: range.anchor,
      head: range.head,
    })),
  });
}

function clamp(value: number, length: number): number {
  return Math.min(Math.max(value, 0), length);
}

/** Replays the recorded steps positionally, like Notepad++ macro playback. */
export function playMacro(view: EditorView): boolean {
  const { steps } = useMacro.getState();
  if (steps.length === 0) return false;

  for (const step of steps) {
    const length = view.state.doc.length;
    const changes = step.changes.map(({ from, to, insert }) => {
      const safeFrom = clamp(from, length);
      return { from: safeFrom, to: clamp(Math.max(to, safeFrom), length), insert };
    });
    const ranges = step.selection.map(({ anchor, head }) =>
      EditorSelection.range(clamp(anchor, length), clamp(head, length)),
    );
    view.dispatch({
      changes,
      ...(ranges.length > 0 ? { selection: EditorSelection.create(ranges, 0) } : {}),
      scrollIntoView: true,
    });
  }
  return true;
}

export function toggleMacroRecording(): void {
  const macro = useMacro.getState();
  const ui = useUi.getState();
  if (macro.recording) {
    macro.stopRecording();
    const count = useMacro.getState().steps.length;
    ui.setStatusMessage(count > 0 ? `宏录制结束，共 ${count} 步` : '宏录制结束，未记录到操作');
    return;
  }
  macro.startRecording();
  ui.setStatusMessage('开始录制宏（再次执行以结束）');
}
