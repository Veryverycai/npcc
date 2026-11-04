import { useEffect, useMemo, useRef, useState } from 'react';

import { documentText } from '@renderer/app/actions';
import { diffLines } from '@renderer/editor/diff';
import { useDocs } from '@renderer/store/documents';
import { useUi } from '@renderer/store/ui';

/** Rendering ten thousand rows would freeze the panel; the tail is elided. */
const MAX_ROWS = 4000;

/**
 * Line-level comparison against another tab. Read-only by design: the panel is
 * a review aid, editing happens in the editor itself.
 */
export function DiffPanel() {
  const docs = useDocs((state) => state.docs);
  const activeId = useDocs((state) => state.activeId);
  const targetId = useUi((state) => state.diffTargetId);
  const setDiffOpen = useUi((state) => state.setDiffOpen);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const others = docs.filter((doc) => doc.id !== activeId);
  const preferredId = pickedId ?? targetId;
  const rightId =
    (preferredId && others.some((doc) => doc.id === preferredId) ? preferredId : null) ??
    others[0]?.id ??
    null;

  const leftDoc = docs.find((doc) => doc.id === activeId) ?? null;
  const rightDoc = others.find((doc) => doc.id === rightId) ?? null;
  // Character counts change on every edit, which is what re-runs the diff.
  const leftSize = leftDoc?.characterCount ?? 0;
  const rightSize = rightDoc?.characterCount ?? 0;

  const result = useMemo(() => {
    if (!activeId || !rightId) return null;
    return diffLines(documentText(activeId), documentText(rightId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sizes stand in for the text
  }, [activeId, rightId, leftSize, rightSize, revision]);

  const rows = result ? result.rows.slice(0, MAX_ROWS) : [];

  useEffect(() => {
    if (!result || result.chunks === 0) return;
    const host = bodyRef.current;
    if (!host) return;
    const target = host.querySelector(`[data-chunk="${currentChunk}"]`);
    target?.scrollIntoView({ block: 'nearest' });
  }, [currentChunk, result]);

  const step = (delta: number): void => {
    if (!result || result.chunks === 0) return;
    setCurrentChunk((value) => {
      const next = value + delta;
      if (next < 1) return 1;
      if (next > result.chunks) return result.chunks;
      return next;
    });
  };

  return (
    <div className="diff-panel">
      <div className="panel-header">
        <span className="panel-title">文本对比</span>
        <span className="panel-hint">只读预览 · 行级 LCS</span>
        <select
          className="panel-select"
          value={rightId ?? ''}
          onChange={(event) => {
            setPickedId(event.target.value || null);
            setCurrentChunk(0);
          }}
        >
          {others.length === 0 && <option value="">没有其它标签</option>}
          {others.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>
        {result && (
          <span className="panel-hint">
            {result.chunks} 处差异 · +{result.added} / -{result.removed}
            {result.truncated ? ' · 文件过大，仅按块比较' : ''}
          </span>
        )}
        <span className="panel-spacer" />
        <button
          type="button"
          className="panel-button"
          disabled={!result || result.chunks === 0}
          onClick={() => step(-1)}
        >
          上一个
        </button>
        <button
          type="button"
          className="panel-button"
          disabled={!result || result.chunks === 0}
          onClick={() => step(1)}
        >
          下一个
        </button>
        <button
          type="button"
          className="panel-button"
          onClick={() => setRevision((v) => v + 1)}
        >
          重新比较
        </button>
        <button type="button" className="panel-button" onClick={() => setDiffOpen(false)}>
          关闭
        </button>
      </div>

      <div className="diff-head">
        <span className="diff-head-cell">{leftDoc?.name ?? '（无标签）'}</span>
        <span className="diff-head-cell">{rightDoc?.name ?? '（无标签）'}</span>
      </div>

      <div className="diff-body" ref={bodyRef}>
        {rows.length === 0 && (
          <div className="panel-empty">两个标签内容一致，或没有可比较的标签。</div>
        )}
        {rows.map((row, index) => (
          <div
            key={index}
            className={`diff-row diff-${row.kind}`}
            data-chunk={row.chunk > 0 ? row.chunk : undefined}
          >
            <span className="diff-no">{row.leftLine ?? ''}</span>
            <span className="diff-text">{row.leftText ?? ''}</span>
            <span className="diff-no">{row.rightLine ?? ''}</span>
            <span className="diff-text">{row.rightText ?? ''}</span>
          </div>
        ))}
        {result && result.rows.length > MAX_ROWS && (
          <div className="panel-empty">仅显示前 {MAX_ROWS} 行对比结果。</div>
        )}
      </div>
    </div>
  );
}
