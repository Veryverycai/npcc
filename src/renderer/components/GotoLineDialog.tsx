import { useState } from 'react';

import { focusEditor } from '@renderer/app/actions';
import { gotoLine } from '@renderer/editor/goto';
import { useDocs } from '@renderer/store/documents';
import { useUi } from '@renderer/store/ui';

/**
 * The form is a separate component so that opening the dialog always starts
 * from a fresh value: mounting resets the field without an effect.
 */
function GotoLineForm({ totalLines }: { totalLines: number }) {
  const setOpen = useUi((state) => state.setGotoLineOpen);
  const [value, setValue] = useState('1');

  const submit = (): void => {
    const line = Number.parseInt(value, 10);
    if (Number.isFinite(line)) gotoLine(line);
    setOpen(false);
    focusEditor();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-label="转到行"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">转到行</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            title="关闭"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="settings-row">
            <span>行号（1 – {totalLines}）</span>
            <input
              autoFocus
              type="number"
              min={1}
              max={totalLines}
              value={value}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                } else if (event.key === 'Escape') {
                  setOpen(false);
                }
              }}
            />
          </label>
        </div>
        <div className="modal-footer">
          <span className="panel-spacer" />
          <button type="button" className="text-button" onClick={() => setOpen(false)}>
            取消
          </button>
          <button type="button" className="text-button primary" onClick={submit}>
            转到
          </button>
        </div>
      </div>
    </div>
  );
}

export function GotoLineDialog() {
  const open = useUi((state) => state.gotoLineOpen);
  const totalLines = useDocs(
    (state) => state.docs.find((doc) => doc.id === state.activeId)?.totalLines ?? 1,
  );
  if (!open) return null;
  return <GotoLineForm totalLines={totalLines} />;
}
