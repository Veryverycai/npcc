import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import {
  closeDocument,
  closeDocumentsToRight,
  closeOtherDocuments,
  copyTextToClipboard,
  createNewFile,
} from '@renderer/app/actions';
import { revealInExplorer } from '@renderer/ipc';
import { useDocs } from '@renderer/store/documents';

export function TabBar() {
  const docs = useDocs((state) => state.docs);
  const activeId = useDocs((state) => state.activeId);
  const setActive = useDocs((state) => state.setActive);
  const move = useDocs((state) => state.move);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Tabs reorder through pointer events because the native file-drop handler
  // replaces WebView2's HTML5 drag-and-drop, so `draggable` never fires.
  const tabRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<{ from: number; startX: number; target: number | null } | null>(null);
  const suppressClick = useRef(false);

  /** Tab whose centre is closest to `x`, used as the drop target. */
  const tabIndexAt = (x: number): number => {
    let closest = 0;
    let best = Number.POSITIVE_INFINITY;
    tabRefs.current.forEach((element, index) => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(x - (rect.left + rect.right) / 2);
      if (distance < best) {
        best = distance;
        closest = index;
      }
    });
    return closest;
  };

  const stopDragging = (): void => {
    dragRef.current = null;
    setDragging(null);
    setDropIndex(null);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>, index: number): void => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.tab-close')) return;
    dragRef.current = { from: index, startX: event.clientX, target: null };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = dragRef.current;
    if (!state) return;
    // A few pixels of slop keep ordinary clicks from becoming drags.
    if (state.target === null && Math.abs(event.clientX - state.startX) < 4) return;
    const target = tabIndexAt(event.clientX);
    state.target = target;
    setDragging(state.from);
    setDropIndex(target);
  };

  const onPointerUp = (): void => {
    const state = dragRef.current;
    if (state && state.target !== null && state.target !== state.from) {
      move(state.from, state.target);
      suppressClick.current = true;
    }
    stopDragging();
  };

  // Escape closes the context menu, like the native menu it mimics.
  useEffect(() => {
    if (!menu) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menu]);

  const menuDoc = menu ? (docs.find((doc) => doc.id === menu.id) ?? null) : null;
  const menuIndex = menuDoc ? docs.findIndex((doc) => doc.id === menuDoc.id) : -1;

  return (
    <div className="tab-bar" role="tablist" aria-label="打开的文件">
      {docs.map((doc, index) => (
        <div
          key={doc.id}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          role="tab"
          aria-selected={doc.id === activeId}
          className={`tab${doc.id === activeId ? ' tab-active' : ''}${
            dragging === index ? ' tab-dragging' : ''
          }${dropIndex === index && dragging !== index ? ' tab-drop-target' : ''}`}
          title={doc.path ?? doc.name}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setActive(doc.id);
          }}
          onPointerDown={(event) => onPointerDown(event, index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={stopDragging}
          onContextMenu={(event) => {
            event.preventDefault();
            setActive(doc.id);
            setMenu({
              id: doc.id,
              x: Math.min(event.clientX, window.innerWidth - 210),
              y: Math.min(event.clientY, window.innerHeight - 220),
            });
          }}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              void closeDocument(doc.id);
            }
          }}
        >
          <span className={`tab-dirty${doc.dirty ? ' is-dirty' : ''}`} aria-hidden>
            ●
          </span>
          <span className="tab-name">{doc.name}</span>
          {doc.readOnly && <span className="tab-badge">只读</span>}
          <button
            type="button"
            className="tab-close"
            aria-label={`关闭 ${doc.name}`}
            onClick={(event) => {
              event.stopPropagation();
              void closeDocument(doc.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="tab-new"
        onClick={createNewFile}
        title="新建文件 (Ctrl+N)"
      >
        +
      </button>
      <div className="tab-bar-filler" />
      {menu && menuDoc && (
        <>
          <div
            className="tab-menu-backdrop"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
          />
          <div className="tab-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <button
              type="button"
              className="tab-menu-item"
              onClick={() => {
                setMenu(null);
                void closeDocument(menuDoc.id);
              }}
            >
              <span>关闭</span>
              <span className="tab-menu-hint">Ctrl+W</span>
            </button>
            <button
              type="button"
              className="tab-menu-item"
              disabled={docs.length < 2}
              onClick={() => {
                setMenu(null);
                void closeOtherDocuments(menuDoc.id);
              }}
            >
              关闭其他标签
            </button>
            <button
              type="button"
              className="tab-menu-item"
              disabled={menuIndex === docs.length - 1}
              onClick={() => {
                setMenu(null);
                void closeDocumentsToRight(menuDoc.id);
              }}
            >
              关闭右侧标签
            </button>
            <div className="tab-menu-sep" />
            <button
              type="button"
              className="tab-menu-item"
              disabled={!menuDoc.path}
              onClick={() => {
                setMenu(null);
                if (menuDoc.path) void copyTextToClipboard(menuDoc.path);
              }}
            >
              复制文件路径
            </button>
            <button
              type="button"
              className="tab-menu-item"
              disabled={!menuDoc.path}
              onClick={() => {
                setMenu(null);
                if (menuDoc.path) void revealInExplorer(menuDoc.path);
              }}
            >
              在资源管理器中显示
            </button>
          </div>
        </>
      )}
    </div>
  );
}
