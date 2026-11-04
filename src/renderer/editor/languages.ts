import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import type { Extension } from '@codemirror/state';

export interface LanguageDef {
  id: string;
  label: string;
  extensions: string[];
  /** Line comment token used by "toggle comment"; empty when unsupported. */
  lineComment: string;
  build: () => Extension;
}

const PLAIN: LanguageDef = {
  id: 'plaintext',
  label: '纯文本',
  extensions: [],
  lineComment: '',
  build: () => [],
};

export const LANGUAGES: LanguageDef[] = [
  PLAIN,
  {
    id: 'c',
    label: 'C/C++',
    extensions: ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'hxx'],
    lineComment: '//',
    build: () => cpp(),
  },
  { id: 'java', label: 'Java', extensions: ['java'], lineComment: '//', build: () => java() },
  {
    id: 'python',
    label: 'Python',
    extensions: ['py', 'pyw', 'pyi'],
    lineComment: '#',
    build: () => python(),
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    lineComment: '//',
    build: () => javascript(),
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['ts', 'tsx', 'mts', 'cts'],
    lineComment: '//',
    build: () => javascript({ typescript: true, jsx: true }),
  },
  {
    id: 'json',
    label: 'JSON',
    extensions: ['json', 'jsonc', 'json5'],
    lineComment: '//',
    build: () => json(),
  },
  {
    id: 'html',
    label: 'HTML',
    extensions: ['html', 'htm', 'xhtml', 'vue', 'svelte'],
    lineComment: '<!--',
    build: () => html(),
  },
  {
    id: 'css',
    label: 'CSS',
    extensions: ['css', 'scss', 'less'],
    lineComment: '/*',
    build: () => css(),
  },
  {
    id: 'xml',
    label: 'XML',
    extensions: ['xml', 'xsd', 'xsl', 'svg', 'plist', 'csproj'],
    lineComment: '<!--',
    build: () => xml(),
  },
  { id: 'sql', label: 'SQL', extensions: ['sql'], lineComment: '--', build: () => sql() },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['md', 'markdown', 'mdx'],
    lineComment: '<!--',
    build: () => markdown(),
  },
  { id: 'rust', label: 'Rust', extensions: ['rs'], lineComment: '//', build: () => rust() },
  { id: 'go', label: 'Go', extensions: ['go'], lineComment: '//', build: () => go() },
  {
    id: 'php',
    label: 'PHP',
    extensions: ['php', 'phtml'],
    lineComment: '//',
    build: () => php(),
  },
  {
    id: 'shell',
    label: 'Shell',
    extensions: ['sh', 'bash', 'zsh', 'ksh'],
    lineComment: '#',
    build: () => StreamLanguage.define(shell),
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    extensions: ['ps1', 'psm1'],
    lineComment: '#',
    build: () => StreamLanguage.define(powerShell),
  },
  {
    id: 'ini',
    label: 'INI/Properties',
    extensions: ['ini', 'cfg', 'conf', 'properties', 'editorconfig'],
    lineComment: ';',
    build: () => StreamLanguage.define(properties),
  },
  {
    id: 'toml',
    label: 'TOML',
    extensions: ['toml'],
    lineComment: '#',
    build: () => StreamLanguage.define(toml),
  },
  {
    id: 'yaml',
    label: 'YAML',
    extensions: ['yaml', 'yml'],
    lineComment: '#',
    build: () => StreamLanguage.define(yaml),
  },
];

const BY_ID = new Map(LANGUAGES.map((language) => [language.id, language]));
const BY_EXTENSION = new Map<string, LanguageDef>();
for (const language of LANGUAGES) {
  for (const extension of language.extensions) {
    BY_EXTENSION.set(extension, language);
  }
}

export function languageById(id: string): LanguageDef {
  return BY_ID.get(id) ?? PLAIN;
}

/** Detects the language from a file name or path; falls back to plain text. */
export function detectLanguage(fileNameOrPath: string): string {
  const name = fileNameOrPath.split(/[\\/]/).pop() ?? fileNameOrPath;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return PLAIN.id;
  const extension = name.slice(dot + 1).toLowerCase();
  return BY_EXTENSION.get(extension)?.id ?? PLAIN.id;
}

export function languageExtension(id: string): Extension {
  return languageById(id).build();
}

export function lineCommentFor(id: string): string {
  return languageById(id).lineComment;
}
