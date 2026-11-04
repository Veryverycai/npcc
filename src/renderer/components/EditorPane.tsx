import { useEffect, useRef } from 'react';
import { EditorView, type ViewUpdate } from '@codemirror/view';

import { HIGHLIGHT_LIMIT_BYTES } from '@shared/constants';
import { useDocs } from '@renderer/store/documents';
import { useSettings } from '@renderer/store/settings';
import { useUi } from '@renderer/store/ui';

import {
  createEditorState,
  createMirrorState,
  reconfigureView,
  setUpdateHandler,
} from '@renderer/editor/createState';
import { recordStep } from '@renderer/editor/macro';
import {
  getStoredState,
  setActiveDocId,
  setActiveView,
  storeState,
} from '@renderer/editor/stateRegistry';

const EMPTY_DOC = '';

/** The mirror always reflects the active document, never its own history. */
function mirrorStateFrom(view: EditorView) {
  const { docs, activeId } = useDocs.getState();
  const doc = docs.find((item) => item.id === activeId);
  return createMirrorState({
    text: view.state.doc.toString(),
    languageId: doc?.languageId ?? 'plaintext',
    settings: useSettings.getState().settings,
    bigFile: (doc?.sizeBytes ?? 0) > HIGHLIGHT_LIMIT_BYTES,
  });
}

export function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const mountedIdRef = useRef<string | null>(null);
  const mirrorHostRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<EditorView | null>(null);

  const activeId = useDocs((state) => state.activeId);
  const docs = useDocs((state) => state.docs);
  const settings = useSettings((state) => state.settings);
  const split = useUi((state) => state.split);
  const overwrite = useUi((state) => state.overwrite);

  const activeDoc = docs.find((doc) => doc.id === activeId) ?? null;
  const languageId = activeDoc?.languageId ?? 'plaintext';
  const isBigFile = (activeDoc?.sizeBytes ?? 0) > HIGHLIGHT_LIMIT_BYTES;

  // One EditorView for the whole app; each tab keeps its own EditorState.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: createEditorState({
        text: EMPTY_DOC,
        languageId: 'plaintext',
        settings: useSettings.getState().settings,
      }),
    });

    setUpdateHandler((update: ViewUpdate) => {
      // The split mirror follows the primary document's changes. The length
      // check guards against a mirror that fell behind (never expected).
      const mirror = mirrorRef.current;
      if (
        mirror &&
        update.docChanged &&
        mirror.state.doc.length === update.startState.doc.length
      ) {
        mirror.dispatch({ changes: update.changes });
      }

      const docId = mountedIdRef.current;
      if (!docId) return;
      recordStep(update);
      const { state } = update;
      const head = state.selection.main;
      const line = state.doc.lineAt(head.head);
      const next = {
        cursorLine: line.number,
        cursorColumn: head.head - line.from + 1,
        selectionLength: head.to - head.from,
        totalLines: state.doc.lines,
        characterCount: state.doc.length,
        ...(update.docChanged ? { dirty: true } : {}),
      };
      useDocs.getState().patch(docId, next);
    });

    viewRef.current = view;
    setActiveView(view);

    return () => {
      setUpdateHandler(null);
      setActiveView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Swap state when the active tab changes, stashing the outgoing one.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const previous = mountedIdRef.current;
    // A tab that was closed already dropped its state, so do not re-stash it.
    if (previous && useDocs.getState().docs.some((doc) => doc.id === previous)) {
      storeState(previous, view.state);
    }

    if (!activeId) {
      mountedIdRef.current = null;
      setActiveDocId(null);
      return;
    }

    const stored = getStoredState(activeId);
    if (stored) {
      view.setState(stored);
    } else {
      const doc = useDocs.getState().docs.find((item) => item.id === activeId);
      view.setState(
        createEditorState({
          text: EMPTY_DOC,
          languageId: doc?.languageId ?? 'plaintext',
          settings: useSettings.getState().settings,
        }),
      );
    }

    mountedIdRef.current = activeId;
    setActiveDocId(activeId);
    const mirror = mirrorRef.current;
    if (mirror) mirror.setState(mirrorStateFrom(view));
    view.focus();
  }, [activeId]);

  // Split view: a read-only mirror sharing the same document, with its own
  // scroll position and selection. Both panes stay in sync through the update
  // bridge above.
  useEffect(() => {
    if (split === 'none') return undefined;
    const host = mirrorHostRef.current;
    const view = viewRef.current;
    if (!host || !view) return undefined;
    const mirror = new EditorView({ parent: host, state: mirrorStateFrom(view) });
    mirrorRef.current = mirror;
    return () => {
      mirrorRef.current = null;
      mirror.destroy();
    };
  }, [split]);

  // Overwrite mode only changes the caret shape, so a class is enough.
  useEffect(() => {
    viewRef.current?.dom.classList.toggle('cm-overwrite', overwrite);
    mirrorRef.current?.dom.classList.toggle('cm-overwrite', overwrite);
  }, [overwrite, split]);

  // Live-apply theme, font, wrapping, gutters and language. Dependencies are
  // primitives so cursor movement does not trigger a reconfiguration.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    reconfigureView(view, settings, languageId, isBigFile);
    const mirror = mirrorRef.current;
    if (mirror) reconfigureView(mirror, settings, languageId, isBigFile);
  }, [settings, languageId, isBigFile, activeId]);

  return (
    <div className={`editor-panes${split === 'none' ? '' : ` split-${split}`}`}>
      <div className="editor-host" ref={hostRef} />
      {split !== 'none' && <div className="editor-host editor-mirror" ref={mirrorHostRef} />}
    </div>
  );
}
