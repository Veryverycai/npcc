import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/**
 * CodeMirror state per document lives here instead of in the Zustand store:
 * the objects are large and must not trigger React re-renders.
 */
const states = new Map<string, EditorState>();
let activeView: EditorView | null = null;
let activeDocId: string | null = null;

export function setActiveView(view: EditorView | null): void {
  activeView = view;
}

export function getActiveView(): EditorView | null {
  return activeView;
}

export function setActiveDocId(docId: string | null): void {
  activeDocId = docId;
}

export function getActiveDocId(): string | null {
  return activeDocId;
}

/** Copies the live view state back into the store before switching tabs. */
export function stashActiveState(): void {
  if (activeView && activeDocId) {
    states.set(activeDocId, activeView.state);
  }
}

export function getStoredState(docId: string): EditorState | undefined {
  return states.get(docId);
}

export function storeState(docId: string, state: EditorState): void {
  states.set(docId, state);
}

export function dropState(docId: string): void {
  states.delete(docId);
}

export function clearAllStates(): void {
  states.clear();
}

export function docCount(): number {
  return states.size;
}
