import { useEffect, useMemo, useRef, useState } from 'react';

import { SEARCH_MAX_PER_FILE, SEARCH_MAX_RESULTS } from '@shared/constants';
import type { FileSearchResult, SearchProgress } from '@shared/types';
import { openLocation, openPaths } from '@renderer/app/actions';
import {
  cancelSearch,
  describeError,
  onSearchProgress,
  openFolder,
  searchInFolder,
  showMessage,
} from '@renderer/ipc';
import { useDocs } from '@renderer/store/documents';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

function directoryOf(path: string | null): string {
  if (!path) return '';
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join('\\');
}

export function SearchPanel() {
  const open = useUi((state) => state.searchPanelOpen);
  const setOpen = useUi((state) => state.setSearchPanelOpen);
  const searchRoot = useUi((state) => state.searchRoot);
  const setSearchRoot = useUi((state) => state.setSearchRoot);

  const activePath = useDocs(
    (state) => state.docs.find((doc) => doc.id === state.activeId)?.path ?? null,
  );
  const defaultExclude = useSettings((state) => state.settings.searchExclude);

  const [rootInput, setRootInput] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState(defaultExclude);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);

  const [running, setRunning] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [matchedFiles, setMatchedFiles] = useState(0);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const searchIdRef = useRef<number | null>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  // A folder picked from the menu wins until the user types in the field.
  const root = rootInput ?? searchRoot ?? directoryOf(activePath);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    void onSearchProgress((progress: SearchProgress) => {
      if (searchIdRef.current !== progress.searchId) return;
      setScanned(progress.scannedFiles);
      setMatchedFiles(progress.matchedFiles);
      if (progress.results.length > 0) {
        setResults((previous) => [...previous, ...progress.results]);
      }
      if (progress.done) {
        setRunning(false);
        setCancelled(progress.cancelled);
        searchIdRef.current = null;
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (open) queryRef.current?.focus();
  }, [open]);

  const totalMatches = useMemo(
    () => results.reduce((sum, file) => sum + file.matches.length, 0),
    [results],
  );

  if (!open) return null;

  const start = async (): Promise<void> => {
    if (!root) {
      await chooseFolder();
      return;
    }
    if (!query.trim()) {
      await showMessage('请输入要查找的内容。', '在文件夹中查找');
      return;
    }
    setResults([]);
    setScanned(0);
    setMatchedFiles(0);
    setCancelled(false);
    setRunning(true);
    try {
      const id = await searchInFolder({
        root,
        query,
        regex,
        caseSensitive,
        wholeWord,
        include: include.trim() ? include : undefined,
        exclude: exclude.trim() ? exclude : undefined,
        maxResults: SEARCH_MAX_RESULTS,
        maxPerFile: SEARCH_MAX_PER_FILE,
      });
      searchIdRef.current = id;
    } catch (error) {
      setRunning(false);
      await showMessage(describeError(error), '搜索失败');
    }
  };

  const stop = async (): Promise<void> => {
    const id = searchIdRef.current;
    if (id === null) return;
    await cancelSearch(id);
  };

  const chooseFolder = async (): Promise<void> => {
    const picked = await openFolder();
    if (!picked) return;
    setRootInput(picked);
    setSearchRoot(picked);
  };

  return (
    <div className="search-panel">
      <div className="panel-header">
        <span className="panel-title">在文件夹中查找</span>
        <span className="panel-progress">
          {running
            ? `扫描 ${scanned} 个文件，命中 ${matchedFiles} 个…`
            : cancelled
              ? `已取消（${matchedFiles} 个文件 / ${totalMatches} 处）`
              : results.length > 0
                ? `${matchedFiles} 个文件 / ${totalMatches} 处`
                : '就绪'}
        </span>
        <span className="panel-spacer" />
        {results.length > 0 && !running && (
          <button
            type="button"
            className="text-button"
            onClick={() => void openPaths(results.map((file) => file.path))}
          >
            打开全部命中文件
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          title="关闭面板"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="search-form">
        <div className="search-form-row">
          <input
            className="search-input search-root"
            value={root}
            placeholder="要搜索的文件夹"
            onChange={(event) => setRootInput(event.target.value)}
          />
          <button type="button" className="text-button" onClick={() => void chooseFolder()}>
            选择…
          </button>
          <input
            ref={queryRef}
            className="search-input search-query"
            value={query}
            placeholder="查找内容"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void start();
            }}
          />
          {running ? (
            <button type="button" className="text-button" onClick={() => void stop()}>
              取消
            </button>
          ) : (
            <button type="button" className="text-button" onClick={() => void start()}>
              搜索
            </button>
          )}
        </div>

        <div className="search-form-row search-form-options">
          <label className="search-field">
            包含
            <input
              className="search-input"
              value={include}
              placeholder="*.ts, src/**/*.rs"
              onChange={(event) => setInclude(event.target.value)}
            />
          </label>
          <label className="search-field">
            排除
            <input
              className="search-input"
              value={exclude}
              placeholder="node_modules, dist"
              onChange={(event) => setExclude(event.target.value)}
            />
          </label>
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
        </div>
      </div>

      <div className="search-results">
        {results.length === 0 && !running && (
          <div className="search-empty">没有结果。选择文件夹并输入要查找的内容。</div>
        )}
        {results.map((file) => (
          <details key={file.path} className="search-file" open>
            <summary title={file.path}>
              <span className="search-file-name">{file.path.split(/[\\/]/).pop()}</span>
              <span className="search-file-path">{file.path}</span>
              <span className="search-file-count">{file.matches.length}</span>
            </summary>
            {file.truncated && (
              <div className="search-more">仅显示前 {file.matches.length} 处</div>
            )}
            {file.matches.map((match, index) => (
              <div
                key={`${file.path}-${match.line}-${match.column}-${index}`}
                className="search-hit"
                role="button"
                tabIndex={0}
                onClick={() => void openLocation(file.path, match.line, match.column)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter')
                    void openLocation(file.path, match.line, match.column);
                }}
              >
                <span className="search-hit-line">
                  {match.line}:{match.column}
                </span>
                <span className="search-hit-preview">{match.preview.trim()}</span>
              </div>
            ))}
          </details>
        ))}
      </div>
    </div>
  );
}
