import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, GutterMarker, gutter, keymap, type ViewUpdate } from '@codemirror/view';

/**
 * Bookmarks are stored as document offsets and mapped through edits, so they
 * follow their line when text above is inserted or removed.
 */
export const toggleBookmark = StateEffect.define<number>();

const bookmarkField = StateField.define<number[]>({
  create: () => [],
  update(positions, transaction) {
    let next = transaction.changes.empty
      ? positions
      : positions.map((position) => transaction.changes.mapPos(position));
    next = [...new Set(next)];
    for (const effect of transaction.effects) {
      if (effect.is(toggleBookmark)) {
        const position = effect.value;
        next = next.includes(position)
          ? next.filter((item) => item !== position)
          : [...next, position];
      }
    }
    return next;
  },
});

class BookmarkMarker extends GutterMarker {
  toDOM(): Node {
    const dot = document.createElement('span');
    dot.className = 'cm-bookmark-dot';
    dot.textContent = '●';
    dot.title = '书签 (Ctrl+F2 切换)';
    return dot;
  }
}

const marker = new BookmarkMarker();

const bookmarkGutter = gutter({
  class: 'cm-bookmark-gutter',
  markers(view) {
    const positions = view.state.field(bookmarkField);
    const builder = new RangeSetBuilder<GutterMarker>();
    for (const position of [...positions].sort((a, b) => a - b)) {
      builder.add(position, position, marker);
    }
    return builder.finish();
  },
  initialSpacer: () => marker,
});

function lineStartAt(view: EditorView): number {
  return view.state.doc.lineAt(view.state.selection.main.head).from;
}

export function toggleBookmarkAtCursor(view: EditorView): boolean {
  view.dispatch({ effects: toggleBookmark.of(lineStartAt(view)) });
  return true;
}

export function clearBookmarks(view: EditorView): boolean {
  for (const position of view.state.field(bookmarkField)) {
    view.dispatch({ effects: toggleBookmark.of(position) });
  }
  return true;
}

/** Jumps to the next (or previous, wrapping) bookmark. */
export function gotoBookmark(view: EditorView, direction: 1 | -1): boolean {
  const positions = [...view.state.field(bookmarkField)].sort((a, b) => a - b);
  if (positions.length === 0) return false;
  const head = view.state.selection.main.head;
  const target =
    direction > 0
      ? (positions.find((position) => position > head) ?? positions[0])
      : ([...positions].reverse().find((position) => position < head) ??
        positions[positions.length - 1]);
  view.dispatch({
    selection: { anchor: target },
    effects: EditorView.scrollIntoView(target, { y: 'center' }),
  });
  return true;
}

const bookmarkKeymap = keymap.of([
  { key: 'Ctrl-F2', run: toggleBookmarkAtCursor, preventDefault: true },
  { key: 'F2', run: (view) => gotoBookmark(view, 1), preventDefault: true },
  { key: 'Shift-F2', run: (view) => gotoBookmark(view, -1), preventDefault: true },
]);

export function bookmarkExtension(): Extension {
  return [bookmarkField, bookmarkGutter, bookmarkKeymap];
}

/** Kept for tests: the mapped positions of the active view. */
export function bookmarksOf(view: EditorView): number[] {
  return [...view.state.field(bookmarkField)];
}

export function isBookmarkUpdate(update: ViewUpdate): boolean {
  return update.startState.field(bookmarkField) !== update.state.field(bookmarkField);
}
