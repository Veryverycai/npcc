import { useEffect, useRef } from 'react';

import { openLocation } from '@renderer/app/actions';
import { selectRangeAt } from '@renderer/editor/goto';
import type { FindHit } from '@renderer/editor/findAll';
import { useDocs } from '@renderer/store/documents';
import { useUi } from '@renderer/store/ui';

interface JumpTarget {
  docId: string;
  path: string | null;
}

function jumpTo(target: JumpTarget, hit: FindHit): void {
  if (target.path) {
    void openLocation(target.path, hit.line, hit.column, hit.length);
    return;
  }
  // Unsaved tabs only exist in the renderer, so activate and select the hit.
  useDocs.getState().setActive(target.docId);
  selectRangeAt(hit.line, hit.column, hit.length);
}

function Preview({ hit }: { hit: FindHit }) {
  const start = Math.max(0, hit.column - 1 - hit.previewOffset);
  const before = hit.preview.slice(0, start);
  const match = hit.preview.slice(start, start + hit.length);
  const after = hit.preview.slice(start + hit.length);
  return (
    <span className="search-hit-preview">
      {hit.previewOffset > 0 && '…'}
      {before}
      <mark className="search-hit-mark">{match}</mark>
      {after}
    </span>
  );
}

/**
 * Notepad++-style "find results" pane: listed below the editor, height
 * adjustable, one group per searched document, click a row to jump there.
 */
export function FindResultsPanel() {
  const isOpen = useUi((state) => state.findResultsOpen);
  const result = useUi((state) => state.findResults);
  const height = useUi((state) => state.findResultsHeight);
  const close = useUi((state) => state.closeFindResults);
  const setHeight = useUi((state) => state.setFindResultsHeight);

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const stop = (): void => {
      dragRef.current = null;
      document.body.classList.remove('is-resizing-row');
    };
    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // A pointerup delivered while the window was unfocused is easy to miss;
      // a button-less move means the drag already ended.
      if (event.buttons === 0) {
        stop();
        return;
      }
      setHeight(drag.startHeight + (drag.startY - event.clientY));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      document.body.classList.remove('is-resizing-row');
    };
  }, [setHeight]);

  if (!isOpen || !result) return null;

  const scopeLabel =
    result.scope === 'document' ? '当前文档' : `${result.searchedDocuments} 个打开的文档`;

  return (
    <div className="find-results" style={{ height }}>
      <div
        className="find-results-resizer"
        role="separator"
        aria-orientation="horizontal"
        title="拖动调整高度"
        onPointerDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: height };
          document.body.classList.add('is-resizing-row');
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
      />
      <div className="panel-header">
        <span className="panel-title">查找结果</span>
        <span className="panel-progress">
          {result.totalHits === 0
            ? `没有匹配项（${scopeLabel}）`
            : `${scopeLabel} · ${result.groups.length} 个文件 / ${result.totalHits} 处`}
        </span>
        <span className="panel-spacer" />
        {result.truncated && <span className="panel-hint">结果过多，已截断</span>}
        <button type="button" className="icon-button" title="关闭 (Esc)" onClick={close}>
          ×
        </button>
      </div>

      <div className="find-results-list">
        {result.groups.length === 0 && (
          <div className="search-empty">没有找到「{result.query.search}」。</div>
        )}
        {result.groups.map((group) => {
          const target: JumpTarget = { docId: group.docId, path: group.path };
          return (
            <details key={group.docId} className="search-file" open>
              <summary title={group.path ?? group.name}>
                <span className="search-file-name">{group.name}</span>
                {group.path && <span className="search-file-path">{group.path}</span>}
                <span className="search-file-count">{group.hits.length}</span>
              </summary>
              {group.truncated && (
                <div className="search-more">仅显示前 {group.hits.length} 处</div>
              )}
              {group.hits.map((hit, index) => (
                <div
                  key={`${hit.line}-${hit.column}-${index}`}
                  className="search-hit"
                  role="button"
                  tabIndex={0}
                  onClick={() => jumpTo(target, hit)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') jumpTo(target, hit);
                  }}
                >
                  <span className="search-hit-line">
                    {hit.line}:{hit.column}
                  </span>
                  <Preview hit={hit} />
                </div>
              ))}
            </details>
          );
        })}
      </div>
    </div>
  );
}
