/**
 * Shared contract between the renderer (TypeScript) and the Rust core.
 * Rust counterparts live in `src-tauri/src/services/*` and
 * `src-tauri/src/commands/*` — keep the field names byte-identical.
 */

export type Encoding =
  'utf-8' | 'utf-8-bom' | 'gbk' | 'gb18030' | 'utf-16le' | 'utf-16be' | 'latin1';

export type Eol = 'lf' | 'crlf' | 'cr';

/** Editor colour templates. The renderer owns the palettes (`editor/theme.ts`). */
export type ThemeName =
  | 'light'
  | 'dark'
  | 'monokai'
  | 'nord'
  | 'solarized-light'
  | 'solarized-dark'
  | 'dracula'
  | 'contrast';

/** Persisted metadata of a document; the text itself lives in the editor state. */
export interface DocMeta {
  id: string;
  path: string | null;
  name: string;
  encoding: Encoding;
  eol: Eol;
  isDirty: boolean;
  readOnly: boolean;
  languageId: string;
}

export interface ReadFileResult {
  path: string;
  content: string;
  encoding: Encoding;
  eol: Eol;
  sizeBytes: number;
  mtimeMs: number;
  truncated: boolean;
  /** True when the byte content was not valid for the detected encoding. */
  hadErrors: boolean;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding: Encoding;
  eol: Eol;
  /** Write a `.bak` copy of the previous content before replacing the file. */
  backup: boolean;
}

export interface WriteFileResult {
  path: string;
  sizeBytes: number;
  mtimeMs: number;
  /** Set when the target encoding cannot represent some characters. */
  hadErrors: boolean;
}

export interface SearchOptions {
  root: string;
  query: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  include?: string;
  exclude?: string;
  maxResults: number;
  maxPerFile: number;
}

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  preview: string;
}

export interface FileSearchResult {
  path: string;
  matches: SearchMatch[];
  truncated: boolean;
}

export interface SearchProgress {
  searchId: number;
  scannedFiles: number;
  matchedFiles: number;
  done: boolean;
  cancelled: boolean;
  results: FileSearchResult[];
}

export interface AppSettings {
  schemaVersion: number;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  insertSpaces: boolean;
  theme: ThemeName;
  wordWrap: boolean;
  showWhitespace: boolean;
  lineNumbers: boolean;
  autoCloseBrackets: boolean;
  highlightActiveLine: boolean;
  /** Highlight every occurrence of the selected text, not just the selection. */
  highlightSelectionMatches: boolean;
  encoding: Encoding;
  eol: Eol;
  recentLimit: number;
  largeFileWarnBytes: number;
  searchExclude: string;
}

export interface SessionTab {
  path: string | null;
  name: string;
  encoding: Encoding;
  eol: Eol;
  languageId: string;
  /** Untitled tab contents are persisted so a crash cannot lose them. */
  draft?: string;
  cursor: number;
}

export interface SessionState {
  schemaVersion: number;
  tabs: SessionTab[];
  activeIndex: number;
}

export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

export interface AppError {
  code: string;
  message: string;
}

/** A command a plugin contributes; `command` is the id it dispatches to. */
export interface PluginCommandContribution {
  id: string;
  title: string;
  command: string;
}

export interface PluginLanguageContribution {
  extensions: string[];
  language: string;
}

export interface PluginContributions {
  commands?: PluginCommandContribution[];
  languages?: PluginLanguageContribution[];
  themes?: string[];
}

/** Mirrors `services::plugins::PluginManifest` on the Rust side. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main?: string | null;
  contributes?: PluginContributions;
  /** Absolute directory of the plugin, filled in by the host. */
  dir: string;
}

/** Request payload sent from a plugin window to the main window. */
export interface PluginRpcRequest {
  requestId: number;
  pluginId: string;
  windowLabel: string;
  method: string;
  args?: unknown;
}

export interface PluginRpcReply {
  requestId: number;
  ok: boolean;
  value?: unknown;
  error?: string;
}
