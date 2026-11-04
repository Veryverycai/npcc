import type { AppSettings, Encoding, Eol } from './types';

export const SCHEMA_VERSION = 1;

/** Files above this size open read-only in preview mode (plan: 20 MB). */
export const LARGE_FILE_PREVIEW_BYTES = 20 * 1024 * 1024;
/** Files above this size are refused outright (plan: 50 MB). */
export const HARD_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
/** Syntax highlighting is turned off above this size to keep typing smooth. */
export const HIGHLIGHT_LIMIT_BYTES = 5 * 1024 * 1024;

export const ENCODING_LABELS: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 BOM',
  gbk: 'GBK',
  gb18030: 'GB18030',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  latin1: 'ISO-8859-1',
};

export const EOL_LABELS: Record<Eol, string> = {
  lf: 'LF',
  crlf: 'CRLF',
  cr: 'CR',
};

export const ENCODING_ORDER: Encoding[] = [
  'utf-8',
  'utf-8-bom',
  'gbk',
  'gb18030',
  'utf-16le',
  'utf-16be',
  'latin1',
];

export const EOL_ORDER: Eol[] = ['lf', 'crlf', 'cr'];

export const SEARCH_MAX_RESULTS = 5000;
export const SEARCH_MAX_PER_FILE = 200;

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: SCHEMA_VERSION,
  fontSize: 14,
  fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
  tabSize: 4,
  insertSpaces: false,
  theme: 'light',
  wordWrap: false,
  showWhitespace: false,
  lineNumbers: true,
  autoCloseBrackets: true,
  highlightActiveLine: true,
  highlightSelectionMatches: true,
  encoding: 'utf-8',
  eol: 'crlf',
  recentLimit: 5,
  largeFileWarnBytes: LARGE_FILE_PREVIEW_BYTES,
  searchExclude: 'node_modules,.git,dist,out,target,.next,.cache',
  backupOnSave: false,
};

export const SEARCH_PROGRESS_EVENT = 'search://progress';
export const MENU_COMMAND_EVENT = 'menu://command';
