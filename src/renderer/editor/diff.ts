/**
 * Line-level diff used by the "compare with another tab" panel. The classic
 * LCS table is fine for source files; very large inputs fall back to a single
 * replaced block so the UI never stalls on a 10k x 10k matrix.
 */

export type DiffKind = 'equal' | 'change' | 'add' | 'remove';

export interface DiffRow {
  kind: DiffKind;
  leftLine: number | null;
  rightLine: number | null;
  leftText: string | null;
  rightText: string | null;
  /** 1-based difference group; 0 marks an unchanged row. */
  chunk: number;
}

export interface DiffResult {
  rows: DiffRow[];
  chunks: number;
  added: number;
  removed: number;
  truncated: boolean;
}

const MAX_LCS_CELLS = 2_000_000;

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  return text.split(/\r\n|\r|\n/);
}

type Op =
  | { equal: true; ai: number; bi: number }
  | { equal: false; ai: number | null; bi: number | null };

function lcsOps(left: string[], right: string[]): Op[] {
  const n = left.length;
  const m = right.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        left[i] === right[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      ops.push({ equal: true, ai: i, bi: j });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ equal: false, ai: i, bi: null });
      i += 1;
    } else {
      ops.push({ equal: false, ai: null, bi: j });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ equal: false, ai: i, bi: null });
    i += 1;
  }
  while (j < m) {
    ops.push({ equal: false, ai: null, bi: j });
    j += 1;
  }
  return ops;
}

export function diffLines(leftText: string, rightText: string): DiffResult {
  const left = splitLines(leftText);
  const right = splitLines(rightText);

  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) {
    start += 1;
  }
  let leftEnd = left.length;
  let rightEnd = right.length;
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd -= 1;
    rightEnd -= 1;
  }

  const rows: DiffRow[] = [];
  let chunk = 0;
  let added = 0;
  let removed = 0;
  let truncated = false;

  const pushEqual = (leftIndex: number, rightIndex: number): void => {
    rows.push({
      kind: 'equal',
      leftLine: leftIndex + 1,
      rightLine: rightIndex + 1,
      leftText: left[leftIndex],
      rightText: right[rightIndex],
      chunk: 0,
    });
  };

  for (let index = 0; index < start; index += 1) pushEqual(index, index);

  const midLeft = left.slice(start, leftEnd);
  const midRight = right.slice(start, rightEnd);

  let ops: Op[];
  if (midLeft.length === 0 && midRight.length === 0) {
    ops = [];
  } else if (midLeft.length * midRight.length > MAX_LCS_CELLS) {
    truncated = true;
    ops = [
      ...midLeft.map((_line, index): Op => ({ equal: false, ai: index, bi: null })),
      ...midRight.map((_line, index): Op => ({ equal: false, ai: null, bi: index })),
    ];
  } else {
    ops = lcsOps(midLeft, midRight);
  }

  // Walk the ops, turning every run of non-equal lines into one diff chunk.
  let index = 0;
  while (index < ops.length) {
    const op = ops[index];
    if (op.equal) {
      pushEqual(start + op.ai, start + op.bi);
      index += 1;
      continue;
    }

    const removedLines: number[] = [];
    const addedLines: number[] = [];
    while (index < ops.length) {
      const step = ops[index];
      if (step.equal) break;
      if (step.ai !== null) removedLines.push(start + step.ai);
      if (step.bi !== null) addedLines.push(start + step.bi);
      index += 1;
    }

    chunk += 1;
    removed += removedLines.length;
    added += addedLines.length;
    const height = Math.max(removedLines.length, addedLines.length);
    for (let offset = 0; offset < height; offset += 1) {
      const leftIndex = removedLines[offset];
      const rightIndex = addedLines[offset];
      const hasLeft = leftIndex !== undefined;
      const hasRight = rightIndex !== undefined;
      rows.push({
        kind: hasLeft && hasRight ? 'change' : hasLeft ? 'remove' : 'add',
        leftLine: hasLeft ? leftIndex + 1 : null,
        rightLine: hasRight ? rightIndex + 1 : null,
        leftText: hasLeft ? left[leftIndex] : null,
        rightText: hasRight ? right[rightIndex] : null,
        chunk,
      });
    }
  }

  for (let offset = 0; offset < left.length - leftEnd; offset += 1) {
    pushEqual(leftEnd + offset, rightEnd + offset);
  }

  return { rows, chunks: chunk, added, removed, truncated };
}
