import { type EditorState, type Extension } from '@codemirror/state';
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';

/**
 * The editor relies on the browser's own selection (see `createState`), which
 * only draws the main range. Extra cursors and their selections — Ctrl+click,
 * Alt+Shift+ArrowUp/Down, `Ctrl+Shift+L` — therefore need painting here, and
 * marks keep the same "characters only" look as the native selection.
 */
class SecondaryCaret extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const caret = document.createElement('span');
    caret.className = 'cm-secondary-caret';
    return caret;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const caret = Decoration.widget({ widget: new SecondaryCaret(), side: 1 });
const selected = Decoration.mark({ class: 'cm-secondary-range' });

export function secondaryPaint(state: EditorState): DecorationSet {
  const { ranges, mainIndex } = state.selection;
  if (ranges.length < 2) return Decoration.none;
  const decorations = [];
  for (let index = 0; index < ranges.length; index += 1) {
    if (index === mainIndex) continue;
    const range = ranges[index];
    decorations.push(
      range.empty
        ? caret.range(range.head)
        : selected.range(Math.min(range.from, range.to), Math.max(range.from, range.to)),
    );
  }
  return Decoration.set(decorations, true);
}

/** Paints every non-main selection range and cursor of a multi-cursor state. */
export function multiRangePaint(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = secondaryPaint(view.state);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
          this.decorations = secondaryPaint(update.state);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
