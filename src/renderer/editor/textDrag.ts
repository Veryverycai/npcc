import { EditorSelection, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

/** A single text change, in the order CodeMirror expects them. */
export interface MoveChange {
  from: number;
  /** Omitted for pure insertions. */
  to?: number;
  insert: string;
}

export interface MovePlan {
  changes: MoveChange[];
  /** Caret offset after the move, so the dragged block stays selected-ish. */
  caret: number;
}

/**
 * Describes how to move `[from, to)` to `target`. Returns `null` when the drop
 * lands inside (or on the edge of) the dragged range, where nothing changes.
 */
export function planTextMove(
  text: string,
  from: number,
  to: number,
  target: number,
): MovePlan | null {
  if (from >= to) return null;
  if (target < 0 || target > text.length) return null;
  if (target >= from && target <= to) return null;
  const payload = text.slice(from, to);
  if (target > to) {
    // Delete first, then insert at the offset the deletion shifts down.
    return {
      changes: [
        { from, to, insert: '' },
        { from: target, insert: payload },
      ],
      caret: target,
    };
  }
  // Insert before the original range, then delete it further to the right.
  return {
    changes: [
      { from: target, insert: payload },
      { from, to, insert: '' },
    ],
    caret: target + payload.length,
  };
}

/** Applies `planTextMove` to a plain string; used by tests and the drag code. */
export function applyTextMove(text: string, plan: MovePlan): string {
  // Offsets refer to the original document, so each later change has to be
  // shifted by the length delta of the changes before it.
  let result = text;
  let offset = 0;
  for (const change of plan.changes) {
    const to = change.to ?? change.from;
    const from = change.from + offset;
    const shiftedTo = to + offset;
    result = result.slice(0, from) + change.insert + result.slice(shiftedTo);
    offset += change.insert.length - (to - change.from);
  }
  return result;
}

interface DragSession {
  from: number;
  to: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/** How far the pointer has to travel before a click becomes a drag. */
const DRAG_SLOP = 4;

/**
 * Drag-and-drop for the selected text. WebView2's own HTML5 dragging is
 * disabled while Tauri owns file drops (`dragDropEnabled`), so the gesture is
 * implemented here: mousedown inside the selection starts a session, mouseup
 * moves the text to the drop offset.
 */
export function textDrag(): Extension {
  return ViewPlugin.fromClass(
    class {
      private session: DragSession | null = null;

      private readonly onDown = (event: MouseEvent): void => {
        this.start(event);
      };

      private readonly onMove = (event: MouseEvent): void => {
        this.move(event);
      };

      private readonly onUp = (event: MouseEvent): void => {
        this.end(event);
      };

      constructor(readonly view: EditorView) {
        // Capture phase: the editor's own handler would collapse the selection
        // before a drag could ever start.
        view.dom.addEventListener('mousedown', this.onDown, true);
      }

      destroy(): void {
        this.view.dom.removeEventListener('mousedown', this.onDown, true);
        this.stopListening();
      }

      private listeners = false;

      private start(event: MouseEvent): void {
        if (event.button !== 0 || event.detail > 1) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const { view } = this;
        const state = view.state;
        if (state.readOnly || state.selection.ranges.length !== 1) return;
        const range = state.selection.main;
        if (range.empty) return;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null || pos < range.from || pos > range.to) return;

        this.session = {
          from: range.from,
          to: range.to,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        if (!this.listeners) {
          window.addEventListener('mousemove', this.onMove, true);
          window.addEventListener('mouseup', this.onUp, true);
          this.listeners = true;
        }
        // Keep the selection: without this the browser collapses it instantly.
        event.preventDefault();
        event.stopPropagation();
      }

      private move(event: MouseEvent): void {
        const session = this.session;
        if (!session) return;
        if (!session.moved) {
          const dx = event.clientX - session.startX;
          const dy = event.clientY - session.startY;
          if (Math.hypot(dx, dy) < DRAG_SLOP) return;
          session.moved = true;
          document.body.classList.add('cm-text-dragging');
        }
        event.preventDefault();
      }

      private end(event: MouseEvent): void {
        const session = this.session;
        this.session = null;
        this.stopListening();
        document.body.classList.remove('cm-text-dragging');
        if (!session) return;

        const target = this.dropPosition(event, session);
        if (target === null) return;
        if (!session.moved) {
          // A plain click inside the selection behaves like Notepad++: the
          // caret lands where the user clicked.
          this.view.dispatch({ selection: EditorSelection.cursor(target) });
          this.view.focus();
          return;
        }
        const plan = planTextMove(
          this.view.state.doc.toString(),
          session.from,
          session.to,
          target,
        );
        if (!plan) return;
        this.view.dispatch({
          changes: plan.changes,
          selection: EditorSelection.cursor(plan.caret),
          userEvent: 'move.drop',
          scrollIntoView: true,
        });
        this.view.focus();
      }

      private stopListening(): void {
        if (!this.listeners) return;
        window.removeEventListener('mousemove', this.onMove, true);
        window.removeEventListener('mouseup', this.onUp, true);
        this.listeners = false;
      }

      /** Offset under the pointer, clamped to the document at the edges. */
      private dropPosition(event: MouseEvent, session: DragSession): number | null {
        const { view } = this;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos !== null) return pos;
        const rect = view.contentDOM.getBoundingClientRect();
        if (event.clientY < rect.top) return 0;
        if (event.clientY > rect.bottom) return view.state.doc.length;
        return session.to;
      }
    },
  );
}
