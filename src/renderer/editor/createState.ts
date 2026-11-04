import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldAll,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  unfoldAll,
} from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import {
  crosshairCursor,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';

import type { AppSettings } from '@shared/types';

import { bookmarkExtension } from './bookmarks';
import { findExtension } from './find';
import { languageExtension } from './languages';
import { multiCursorExtension } from './multicursor';
import { multiRangePaint } from './multiRangePaint';
import { overwriteExtension } from './overwrite';
import { selectionEdge } from './selectionEdge';
import { textDrag } from './textDrag';
import { editorTheme } from './theme';
import { whitespacePlugin } from './whitespace';

export const themeCompartment = new Compartment();
export const languageCompartment = new Compartment();
export const layoutCompartment = new Compartment();

/**
 * One EditorView serves every tab, so the update listener cannot be attached
 * per mount. States carry this bridge and report to the currently set handler.
 */
type UpdateHandler = (update: ViewUpdate) => void;

let updateHandler: UpdateHandler | null = null;

export function setUpdateHandler(handler: UpdateHandler | null): void {
  updateHandler = handler;
}

const updateBridge = EditorView.updateListener.of((update) => {
  updateHandler?.(update);
});

/** Layout + behaviour extensions rebuilt whenever the settings change. */
export function layoutExtensions(settings: AppSettings, bigFile: boolean): Extension {
  return [
    settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : [],
    settings.highlightActiveLine ? highlightActiveLine() : [],
    // Highlights every other occurrence of the selected text.
    settings.highlightSelectionMatches ? highlightSelectionMatches() : [],
    settings.wordWrap ? EditorView.lineWrapping : [],
    settings.showWhitespace ? whitespacePlugin() : [],
    settings.autoCloseBrackets ? closeBrackets() : [],
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(settings.tabSize),
    indentUnit.of(settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t'),
    indentOnInput(),
    bigFile ? [] : bracketMatching(),
    bigFile ? [] : foldGutter({ openText: '▾', closedText: '▸' }),
    dropCursor(),
    rectangularSelection({ eventFilter: (event) => event.altKey && event.button === 0 }),
    crosshairCursor({ key: 'Alt' }),
    // Deliberately no drawSelection(): its overlay fills the whole row for a
    // selected line break, so Ctrl+A tinted the space after every line. The
    // native selection (styled in editorTheme through ::selection) only paints
    // real characters, which is what Notepad++ shows.
  ];
}

function baseExtensions(settings: AppSettings, bigFile: boolean): Extension[] {
  return [
    history(),
    findExtension(),
    bookmarkExtension(),
    multiCursorExtension(),
    multiRangePaint(),
    overwriteExtension(),
    textDrag(),
    selectionEdge(),
    updateBridge,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      // Notepad++ muscle memory on top of the default Ctrl-Alt-[/] pair.
      { key: 'Ctrl-Alt-f', run: foldAll },
      { key: 'Ctrl-Alt-Shift-f', run: unfoldAll },
      indentWithTab,
    ]),
    themeCompartment.of(editorTheme(settings)),
    layoutCompartment.of(layoutExtensions(settings, bigFile)),
  ];
}

export interface EditorStateOptions {
  text: string;
  languageId: string;
  settings: AppSettings;
  /** Large files skip highlighting and folding to stay responsive. */
  bigFile?: boolean;
}

export function createEditorState({
  text,
  languageId,
  settings,
  bigFile = false,
}: EditorStateOptions): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      ...baseExtensions(settings, bigFile),
      languageCompartment.of(bigFile ? [] : languageExtension(languageId)),
    ],
  });
}

/**
 * Read-only mirror used by the split view. It shares the theme/layout/language
 * compartments with the primary editor but owns its own scroll and selection.
 */
export function createMirrorState({
  text,
  languageId,
  settings,
  bigFile = false,
}: EditorStateOptions): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      themeCompartment.of(editorTheme(settings)),
      layoutCompartment.of(layoutExtensions(settings, bigFile)),
      languageCompartment.of(bigFile ? [] : languageExtension(languageId)),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ],
  });
}

/** Re-applies theme, layout and language after a settings change. */
export function reconfigureView(
  view: EditorView,
  settings: AppSettings,
  languageId: string,
  bigFile: boolean,
): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(editorTheme(settings)),
      layoutCompartment.reconfigure(layoutExtensions(settings, bigFile)),
      languageCompartment.reconfigure(bigFile ? [] : languageExtension(languageId)),
    ],
  });
}
