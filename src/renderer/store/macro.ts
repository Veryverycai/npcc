import { create } from 'zustand';

/** One recorded transaction, stored as plain data so it can be replayed later. */
export interface MacroStep {
  changes: Array<{ from: number; to: number; insert: string }>;
  selection: Array<{ anchor: number; head: number }>;
}

interface MacroStore {
  recording: boolean;
  steps: MacroStep[];
  startRecording: () => void;
  stopRecording: () => void;
  addStep: (step: MacroStep) => void;
  clear: () => void;
}

/**
 * Macros live in memory only: they are a convenience while the app runs, not
 * a persisted feature (see the plan, F7).
 */
export const useMacro = create<MacroStore>((set) => ({
  recording: false,
  steps: [],
  startRecording: () => set({ recording: true, steps: [] }),
  stopRecording: () => set({ recording: false }),
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  clear: () => set({ recording: false, steps: [] }),
}));
