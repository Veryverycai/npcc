import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';

import { focusEditor } from '@renderer/app/actions';
import { runFindAll } from '@renderer/app/findAll';
import {
  buildRegex,
  collectMatches,
  EMPTY_QUERY,
  setQuery,
  type FindQuery,
  type MatchRange,
} from '@renderer/editor/find';
import { getActiveView } from '@renderer/editor/stateRegistry';
import { useDocs } from '@renderer/store/documents';
import { useUi } from '@renderer/store/ui';
import { confirmReplaceAll } from '@renderer/ipc';

function matchesWithin(view: EditorView, query: FindQuery, inSelection: boolean): MatchRange[] {
  const all = collectMatches(view.state, query);
  if (!inSelection) return all;
  const selection = view.state.selection.main;
  if (selection.empty) return all;
  return all.filter((match) => match.from >= selection.from && match.to <= selection.to);
}

export function FindPanel() {
  const findOpen = useUi((state) => state.findOpen);
  const replaceMode = useUi((state) => state.findReplaceMode);
  const closeFind = useUi((state) => state.closeFind);
  const setStatusMessage = useUi((state) => state.setStatusMessage);

  const activeId = useDocs((state) => state.activeId);
  const characterCount = useDocs(
    (state) => state.docs.find((doc) => doc.id === state.activeId)?.characterCount ?? 0,
  );
  const documentCount = useDocs((state) => state.docs.length);

  // The panel remembers its last query so a reopen (or a Search-menu command)
  // can reuse it without retyping.
  const [search, setSearch] = useState(() => useUi.getState().findQuery.search);
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(
    () => useUi.getState().findQuery.caseSensitive,
  );
  const [wholeWord, setWholeWord] = useState(() => useUi.getState().findQuery.wholeWord);
  const [regex, setRegex] = useState(() => useUi.getState().findQuery.regex);
  const [inSelection, setInSelection] = useState(false);
  const [revision, setRevision] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);

  const query: FindQuery = useMemo(
    () => ({ search, regex, caseSensitive, wholeWord }),
    [search, regex, caseSensitive, wholeWord],
  );

  // Counting derives from the live editor state, so it is a pure read during
  // render keyed on the document length plus a manual revision counter.
  const { total, current, invalid } = useMemo(() => {
    const view = getActiveView();
    if (!view || !search) return { total: 0, current: -1, invalid: false };
    if (!buildRegex(query)) return { total: 0, current: -1, invalid: true };
    const matches = matchesWithin(view, query, inSelection);
    const head = view.state.selection.main.head;
    const index = matches.findIndex((match) => match.from >= head);
    return {
      total: matches.length,
      current: matches.length === 0 ? -1 : index >= 0 ? index : matches.length - 1,
      invalid: false,
    };
    // revision is bumped after navigation so the readout follows the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys only force a recount
  }, [query, inSelection, search, activeId, characterCount, revision]);

  // Highlight search hits in the editor while the panel is open.
  useEffect(() => {
    const view = getActiveView();
    if (!view) return;
    setQuery(view, search && buildRegex(query) ? query : EMPTY_QUERY);
  }, [query, search, activeId]);

  // Keep the shared query in sync for the Search-menu "find all" commands.
  useEffect(() => {
    useUi.getState().setFindQuery(query);
  }, [query]);

  useEffect(() => {
    if (!findOpen) return;
    const input = searchRef.current;
    input?.focus();
    input?.select();
  }, [findOpen, replaceMode]);

  if (!findOpen) return null;

  const move = (direction: 1 | -1): void => {
    const view = getActiveView();
    if (!view) return;
    const matches = matchesWithin(view, query, inSelection);
    if (matches.length === 0) return;
    const selection = view.state.selection.main;
    let target: MatchRange;
    if (direction > 0) {
      target = matches.find((match) => match.from >= selection.to) ?? matches[0];
    } else {
      const reversed = [...matches].reverse();
      target =
        reversed.find((match) => match.to <= selection.from) ?? matches[matches.length - 1];
    }
    view.dispatch({
      selection: { anchor: target.from, head: target.to },
      effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
    });
    view.focus();
    setRevision((value) => value + 1);
  };

  const replaceOne = (): void => {
    const view = getActiveView();
    if (!view) return;
    const matches = matchesWithin(view, query, inSelection);
    if (matches.length === 0) return;
    const selection = view.state.selection.main;
    const target =
      matches.find((match) => match.from === selection.from && match.to === selection.to) ??
      matches.find((match) => match.from >= selection.to) ??
      matches[0];
    view.dispatch({
      changes: { from: target.from, to: target.to, insert: replacement },
      selection: { anchor: target.from + replacement.length },
    });
    move(1);
  };

  const replaceEvery = async (): Promise<void> => {
    const view = getActiveView();
    if (!view) return;
    const matches = matchesWithin(view, query, inSelection);
    if (matches.length === 0) {
      setStatusMessage('没有匹配项');
      return;
    }
    if (!(await confirmReplaceAll(matches.length))) return;
    view.dispatch({
      changes: matches.map((match) => ({
        from: match.from,
        to: match.to,
        insert: replacement,
      })),
      selection: { anchor: matches[0].from + replacement.length },
    });
    view.focus();
    setStatusMessage(`已替换 ${matches.length} 处`);
  };

  const handleEscape = (): void => {
    closeFind();
    const view = getActiveView();
    if (view) {
      setQuery(view, EMPTY_QUERY);
    }
    focusEditor();
  };

  return (
    <div
      className="find-panel"
      role="dialog"
      aria-label="查找与替换"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          handleEscape();
        } else if (event.key === 'Enter' && event.target === searchRef.current) {
          event.preventDefault();
          move(event.shiftKey ? -1 : 1);
        }
      }}
    >
      <div className="find-row">
        <span className="find-title">{replaceMode ? '替换' : '查找'}</span>
        <input
          ref={searchRef}
          className={`find-input${invalid ? ' is-invalid' : ''}`}
          placeholder={invalid ? '正则表达式无效' : '查找内容'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="find-count">
          {invalid ? '—' : total === 0 ? '0/0' : `${current + 1}/${total}`}
        </span>
        <button
          type="button"
          className="icon-button"
          title="上一个 (Shift+Enter)"
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          title="下一个 (Enter)"
          onClick={() => move(1)}
        >
          ↓
        </button>
        <button type="button" className="icon-button" title="关闭 (Esc)" onClick={handleEscape}>
          ×
        </button>
      </div>

      {replaceMode && (
        <div className="find-row">
          <span className="find-title">替换为</span>
          <input
            className="find-input"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
          />
          <button type="button" className="text-button" onClick={replaceOne}>
            替换
          </button>
          <button type="button" className="text-button" onClick={() => void replaceEvery()}>
            全部替换
          </button>
        </div>
      )}

      <div className="find-row find-options">
        <button
          type="button"
          className={`toggle-button${caseSensitive ? ' is-on' : ''}`}
          aria-pressed={caseSensitive}
          title="区分大小写"
          onClick={() => setCaseSensitive((value) => !value)}
        >
          Aa
        </button>
        <button
          type="button"
          className={`toggle-button${wholeWord ? ' is-on' : ''}`}
          aria-pressed={wholeWord}
          title="全词匹配"
          onClick={() => setWholeWord((value) => !value)}
        >
          ab
        </button>
        <button
          type="button"
          className={`toggle-button${regex ? ' is-on' : ''}`}
          aria-pressed={regex}
          title="正则表达式"
          onClick={() => setRegex((value) => !value)}
        >
          .*
        </button>
        <button
          type="button"
          className={`toggle-button${inSelection ? ' is-on' : ''}`}
          aria-pressed={inSelection}
          title="仅在选区内查找"
          onClick={() => setInSelection((value) => !value)}
        >
          选区
        </button>
      </div>

      {/* Notepad++ parity: list every hit in the bottom pane. */}
      <div className="find-row find-actions">
        <button
          type="button"
          className="text-button"
          title="在本文档中列出全部匹配（下方分屏显示）"
          onClick={() => runFindAll(query, 'document')}
        >
          本文档全部
        </button>
        <button
          type="button"
          className="text-button"
          disabled={documentCount === 0}
          title={`在所有打开的 ${documentCount} 个标签中列出全部匹配`}
          onClick={() => runFindAll(query, 'open-documents')}
        >
          打开的文档全部
        </button>
        <span className="find-hint">结果显示在下方，点击可跳转</span>
      </div>
    </div>
  );
}
