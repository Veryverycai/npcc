import { buildRegex, type FindQuery } from './find';

/** Per-document hit cap, mirroring Notepad++'s "too many hits" cut-off. */
export const FIND_ALL_PER_FILE = 500;
/** Global cap across every searched document. */
export const FIND_ALL_TOTAL = 3000;
/** Longest preview kept per hit; the whole line is shown up to this length. */
const PREVIEW_LIMIT = 400;

export type FindScope = 'document' | 'open-documents';

export interface FindHit {
  /** 1-based line number. */
  line: number;
  /** 1-based column of the first matched character. */
  column: number;
  /** Matched length in characters. */
  length: number;
  /** Text of the line that contains the hit, windowed for very long lines. */
  preview: string;
  /** 0-based index inside the line where `preview` starts. */
  previewOffset: number;
}

export interface FileFindHits {
  hits: FindHit[];
  truncated: boolean;
}

/** One searched document in the results panel. */
export interface FindFileGroup {
  docId: string;
  name: string;
  path: string | null;
  hits: FindHit[];
  truncated: boolean;
}

/** Everything the bottom panel needs to render one "find all" run. */
export interface FindAllResult {
  scope: FindScope;
  query: FindQuery;
  groups: FindFileGroup[];
  totalHits: number;
  /** True when a per-file or global cap cut the list short. */
  truncated: boolean;
  /** Number of documents the run actually looked at. */
  searchedDocuments: number;
}

/** Offsets at which every line starts, used to map a match offset to line/column. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineOf(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, high);
}

function previewOf(
  text: string,
  starts: number[],
  lineIndex: number,
  matchColumn: number,
): { preview: string; previewOffset: number } {
  const from = starts[lineIndex];
  const to = lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : text.length;
  const raw = text.slice(from, to).replace(/\r$/, '');
  if (raw.length <= PREVIEW_LIMIT) return { preview: raw, previewOffset: 0 };
  // Keep the hit visible instead of always showing the head of the line.
  const start = Math.max(0, Math.min(matchColumn - 40, raw.length - PREVIEW_LIMIT));
  return { preview: raw.slice(start, start + PREVIEW_LIMIT), previewOffset: start };
}

/**
 * Every match of `query` inside `text`, converted to 1-based line/column with
 * the full containing line as preview. Stops after `limit` hits.
 */
export function findAllInText(
  text: string,
  query: FindQuery,
  limit = FIND_ALL_PER_FILE,
): FileFindHits {
  const regex = buildRegex(query);
  if (!regex) return { hits: [], truncated: false };
  const starts = lineStarts(text);
  const hits: FindHit[] = [];
  let found: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((found = regex.exec(text)) !== null) {
    if (found[0].length === 0) {
      // A zero-width match would loop forever; step over it like the editor does.
      regex.lastIndex += 1;
      continue;
    }
    const offset = found.index;
    const lineIndex = lineOf(starts, offset);
    const column = offset - starts[lineIndex];
    const { preview, previewOffset } = previewOf(text, starts, lineIndex, column);
    hits.push({
      line: lineIndex + 1,
      column: column + 1,
      length: found[0].length,
      preview,
      previewOffset,
    });
    if (hits.length >= limit) {
      // One more probe tells a truncated list apart from an exact fit.
      const rest = regex.exec(text);
      return { hits, truncated: rest !== null };
    }
  }
  return { hits, truncated: false };
}
