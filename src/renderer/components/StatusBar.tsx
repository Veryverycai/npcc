import { ENCODING_LABELS, ENCODING_ORDER, EOL_LABELS, EOL_ORDER } from '@shared/constants';
import type { Encoding, Eol } from '@shared/types';
import {
  changeZoom,
  resetZoom,
  setActiveEncoding,
  setActiveEol,
  setActiveLanguage,
} from '@renderer/app/actions';
import { LANGUAGES } from '@renderer/editor/languages';
import { toggleOverwrite } from '@renderer/editor/overwrite';
import { useDocs } from '@renderer/store/documents';
import { useMacro } from '@renderer/store/macro';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function StatusBar() {
  const docs = useDocs((state) => state.docs);
  const activeId = useDocs((state) => state.activeId);
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const doc = docs.find((item) => item.id === activeId);
  const overwrite = useUi((state) => state.overwrite);
  const recording = useMacro((state) => state.recording);
  const macroSteps = useMacro((state) => state.steps.length);

  return (
    <div className="status-bar">
      {doc ? (
        <>
          <span className="status-item">
            行 {doc.cursorLine}, 列 {doc.cursorColumn}
          </span>
          {doc.selectionLength > 0 && (
            <span className="status-item">选区 {formatCount(doc.selectionLength)}</span>
          )}
          <span className="status-item">{formatCount(doc.characterCount)} 字符</span>
          <span className="status-item">{formatCount(doc.totalLines)} 行</span>

          <span className="status-spacer" />

          <label className="status-select" title="文本编码（保存时按此编码写盘）">
            <select
              value={doc.encoding}
              onChange={(event) => setActiveEncoding(event.target.value as Encoding)}
            >
              {ENCODING_ORDER.map((encoding) => (
                <option key={encoding} value={encoding}>
                  {ENCODING_LABELS[encoding]}
                </option>
              ))}
            </select>
          </label>

          <label className="status-select" title="换行符">
            <select
              value={doc.eol}
              onChange={(event) => setActiveEol(event.target.value as Eol)}
            >
              {EOL_ORDER.map((eol) => (
                <option key={eol} value={eol}>
                  {EOL_LABELS[eol]}
                </option>
              ))}
            </select>
          </label>

          <label className="status-select" title="语法高亮语言">
            <select
              value={doc.languageId}
              onChange={(event) => setActiveLanguage(event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="status-item status-button"
            title="缩进方式"
            onClick={() => update({ insertSpaces: !settings.insertSpaces })}
          >
            {settings.insertSpaces ? `空格:${settings.tabSize}` : `Tab:${settings.tabSize}`}
          </button>

          <button
            type="button"
            className={`status-item status-button${overwrite ? ' status-warn' : ''}`}
            title="插入 / 覆盖模式（Insert 键切换）"
            onClick={toggleOverwrite}
          >
            {overwrite ? 'OVR' : 'INS'}
          </button>

          {recording && <span className="status-item status-recording">● 宏 {macroSteps}</span>}

          <button
            type="button"
            className="status-item status-button"
            title="点击重置为 100%"
            onClick={resetZoom}
            onWheel={(event) => {
              event.preventDefault();
              changeZoom(event.deltaY < 0 ? 1 : -1);
            }}
          >
            {Math.round((settings.fontSize / 14) * 100)}%
          </button>
        </>
      ) : (
        <span className="status-item">就绪</span>
      )}
    </div>
  );
}
