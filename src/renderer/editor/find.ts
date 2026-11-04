import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

export interface FindQuery {
  search: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export const EMPTY_QUERY: FindQuery = {
  search: '',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
};

export interface MatchRange {
  from: number;
  to: number;
}

const MATCH_LIMIT = 20000;

export const setFindQuery = StateEffect.define<FindQuery>();

export const findQueryField = StateField.define<FindQuery>({
  create: () => EMPTY_QUERY,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFindQuery)) return effect.value;
    }
    return value;
  },
});

/** Builds the regular expression behind a query, or null when it is unusable. */
export function buildRegex(query: FindQuery): RegExp | null {
  if (!query.search) return null;
  let pattern = query.regex ? query.search : escapeRegExp(query.search);
  if (query.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  const flags = query.caseSensitive ? 'gm' : 'gim';
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidQuery(query: FindQuery): boolean {
  return query.search.length > 0 && buildRegex(query) !== null;
}

/** All matches in the document, capped so a pathological regex cannot hang the UI. */
export function collectMatches(
  state: EditorState,
  query: FindQuery,
  limit = MATCH_LIMIT,
): MatchRange[] {
  const regex = buildRegex(query);
  if (!regex) return [];
  const text = state.doc.toString();
  const matches: MatchRange[] = [];
  let found: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((found = regex.exec(text)) !== null) {
    if (found[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    matches.push({ from: found.index, to: found.index + found[0].length });
    if (matches.length >= limit) break;
  }
  return matches;
}

export function countMatches(state: EditorState, query: FindQuery): number {
  return collectMatches(state, query).length;
}

/** Index of the match at/after the cursor, used for the "n / m" readout. */
export function currentMatchIndex(state: EditorState, matches: MatchRange[]): number {
  if (matches.length === 0) return -1;
  const head = state.selection.main.head;
  const index = matches.findIndex((match) => match.from >= head);
  if (index >= 0) return index;
  return state.selection.main.empty ? 0 : matches.length - 1;
}

export function selectMatch(view: EditorView, match: MatchRange): void {
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
    scrollIntoView: false,
  });
  view.focus();
}

export function findNext(view: EditorView, query: FindQuery, backwards = false): boolean {
  const matches = collectMatches(view.state, query);
  if (matches.length === 0) return false;
  const head = backwards ? view.state.selection.main.from : view.state.selection.main.to;
  let target: MatchRange | undefined;
  if (backwards) {
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      if (matches[index].to <= head) {
        target = matches[index];
        break;
      }
    }
    target ??= matches[matches.length - 1];
  } else {
    target = matches.find((match) => match.from >= head);
    target ??= matches[0];
  }
  selectMatch(view, target);
  return true;
}

export function replaceCurrent(
  view: EditorView,
  query: FindQuery,
  replacement: string,
): boolean {
  const selection = view.state.selection.main;
  if (selection.empty) {
    if (!findNext(view, query)) return false;
  }
  const target = view.state.selection.main;
  view.dispatch({
    changes: { from: target.from, to: target.to, insert: replacement },
    selection: { anchor: target.from + replacement.length },
  });
  findNext(view, query);
  return true;
}

/** Replaces every match in one transaction, so a single undo reverts it all. */
export function replaceAll(view: EditorView, query: FindQuery, replacement: string): number {
  const matches = collectMatches(view.state, query);
  if (matches.length === 0) return 0;
  view.dispatch({
    changes: matches.map((match) => ({ from: match.from, to: match.to, insert: replacement })),
  });
  return matches.length;
}

export function setQuery(view: EditorView, query: FindQuery): void {
  view.dispatch({ effects: setFindQuery.of(query) });
}

const matchDecoration = Decoration.mark({ class: 'cm-searchMatch' });
const currentDecoration = Decoration.mark({
  class: 'cm-searchMatch cm-searchMatch-selected',
});

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const query = view.state.field(findQueryField, false) ?? EMPTY_QUERY;
  const regex = buildRegex(query);
  if (!regex) return builder.finish();
  const selection = view.state.selection.main;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    regex.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = regex.exec(text)) !== null) {
      if (found[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      const start = from + found.index;
      const end = start + found[0].length;
      const isCurrent = !selection.empty && start <= selection.from && end >= selection.to;
      builder.add(start, end, isCurrent ? currentDecoration : matchDecoration);
    }
  }
  return builder.finish();
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(setFindQuery)) {
            this.decorations = buildDecorations(update.view);
          }
        }
      }
    }
  },
  { decorations: (value) => value.decorations },
);

export function findExtension(): Extension {
  return [findQueryField, highlighter];
}
