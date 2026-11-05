import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';

import type { AppSettings, ThemeName } from '@shared/types';

export type { ThemeName };

/** Colours for the lezer tags every language maps onto. */
export interface SyntaxPalette {
  keyword: string;
  control: string;
  name: string;
  function: string;
  property: string;
  type: string;
  number: string;
  string: string;
  comment: string;
  tag: string;
  attribute: string;
  link: string;
  invalid: string;
}

export interface ThemeSpec {
  name: ThemeName;
  label: string;
  dark: boolean;
  background: string;
  foreground: string;
  gutterBackground: string;
  gutterForeground: string;
  activeLine: string;
  selection: string;
  /** Background of the other occurrences of the selected text. */
  selectionMatch: string;
  selectionMatchBorder: string;
  cursor: string;
  matchingBracket: string;
  searchMatch: string;
  searchMatchCurrent: string;
  syntax: SyntaxPalette;
}

export const THEME_ORDER: ThemeName[] = [
  'light',
  'dark',
  'monokai',
  'nord',
  'dracula',
  'solarized-light',
  'solarized-dark',
  'contrast',
];

/**
 * Every template is a complete palette: editor chrome, selection colours and
 * syntax tags. `base.css` mirrors the chrome values as CSS variables so the
 * surrounding UI switches together with the editor.
 */
export const THEMES: Record<ThemeName, ThemeSpec> = {
  light: {
    name: 'light',
    label: '浅色',
    dark: false,
    background: '#ffffff',
    foreground: '#1f2328',
    gutterBackground: '#f6f8fa',
    gutterForeground: '#6e7781',
    activeLine: '#f2f5f8',
    selection: '#b6dcff',
    selectionMatch: '#ffe9a8',
    selectionMatchBorder: '#d9b64a',
    cursor: '#0969da',
    matchingBracket: '#ffdf5d',
    searchMatch: '#ffe08a',
    searchMatchCurrent: '#ffb347',
    syntax: {
      keyword: '#cf222e',
      control: '#8250df',
      name: '#1f2328',
      function: '#6639ba',
      property: '#0550ae',
      type: '#953800',
      number: '#0550ae',
      string: '#0a3069',
      comment: '#6e7781',
      tag: '#116329',
      attribute: '#953800',
      link: '#0969da',
      invalid: '#cf222e',
    },
  },
  dark: {
    name: 'dark',
    label: '深色',
    dark: true,
    background: '#1e2227',
    foreground: '#d7dde5',
    gutterBackground: '#191d21',
    gutterForeground: '#7b8494',
    activeLine: '#262b32',
    selection: '#35557d',
    selectionMatch: '#4d4122',
    selectionMatchBorder: '#a3862f',
    cursor: '#7fb3ff',
    matchingBracket: '#4d6b8a',
    searchMatch: '#4a4120',
    searchMatchCurrent: '#7a6420',
    syntax: {
      keyword: '#cf8ef4',
      control: '#c792ea',
      name: '#d7dde5',
      function: '#82aaff',
      property: '#7fdbca',
      type: '#ffcb6b',
      number: '#f78c6c',
      string: '#c3e88d',
      comment: '#697098',
      tag: '#f07178',
      attribute: '#ffcb6b',
      link: '#80cbc4',
      invalid: '#ff5370',
    },
  },
  monokai: {
    name: 'monokai',
    label: 'Monokai',
    dark: true,
    background: '#272822',
    foreground: '#f8f8f2',
    gutterBackground: '#22231d',
    gutterForeground: '#8a8578',
    activeLine: '#34352c',
    selection: '#5a594d',
    selectionMatch: '#4d4416',
    selectionMatchBorder: '#a08a2d',
    cursor: '#f8f8f0',
    matchingBracket: '#57573f',
    searchMatch: '#5c5220',
    searchMatchCurrent: '#8f7a1f',
    syntax: {
      keyword: '#f92672',
      control: '#f92672',
      name: '#f8f8f2',
      function: '#a6e22e',
      property: '#66d9ef',
      type: '#66d9ef',
      number: '#ae81ff',
      string: '#e6db74',
      comment: '#75715e',
      tag: '#f92672',
      attribute: '#a6e22e',
      link: '#66d9ef',
      invalid: '#f92672',
    },
  },
  nord: {
    name: 'nord',
    label: 'Nord',
    dark: true,
    background: '#2e3440',
    foreground: '#d8dee9',
    gutterBackground: '#2b303a',
    gutterForeground: '#7b8698',
    activeLine: '#343b48',
    selection: '#434c5e',
    selectionMatch: '#4a4531',
    selectionMatchBorder: '#b9a45a',
    cursor: '#88c0d0',
    matchingBracket: '#5e81ac',
    searchMatch: '#4a4531',
    searchMatchCurrent: '#8a6f2f',
    syntax: {
      keyword: '#81a1c1',
      control: '#b48ead',
      name: '#d8dee9',
      function: '#88c0d0',
      property: '#8fbcbb',
      type: '#8fbcbb',
      number: '#b48ead',
      string: '#a3be8c',
      comment: '#616e88',
      tag: '#81a1c1',
      attribute: '#8fbcbb',
      link: '#5e81ac',
      invalid: '#bf616a',
    },
  },
  dracula: {
    name: 'dracula',
    label: 'Dracula',
    dark: true,
    background: '#282a36',
    foreground: '#f8f8f2',
    gutterBackground: '#21222c',
    gutterForeground: '#7b81a6',
    activeLine: '#343746',
    selection: '#44475a',
    selectionMatch: '#4b4526',
    selectionMatchBorder: '#b8a656',
    cursor: '#f8f8f2',
    matchingBracket: '#6272a4',
    searchMatch: '#4b4526',
    searchMatchCurrent: '#8f7a1f',
    syntax: {
      keyword: '#ff79c6',
      control: '#ff79c6',
      name: '#f8f8f2',
      function: '#50fa7b',
      property: '#8be9fd',
      type: '#8be9fd',
      number: '#bd93f9',
      string: '#f1fa8c',
      comment: '#6272a4',
      tag: '#ff79c6',
      attribute: '#50fa7b',
      link: '#8be9fd',
      invalid: '#ff5555',
    },
  },
  'solarized-light': {
    name: 'solarized-light',
    label: 'Solarized Light',
    dark: false,
    background: '#fdf6e3',
    foreground: '#586e75',
    gutterBackground: '#eee8d5',
    gutterForeground: '#839496',
    activeLine: '#f5efdc',
    selection: '#cfe3ea',
    selectionMatch: '#f6e6a2',
    selectionMatchBorder: '#c9b45b',
    cursor: '#268bd2',
    matchingBracket: '#d7c37a',
    searchMatch: '#f6e6a2',
    searchMatchCurrent: '#e0c060',
    syntax: {
      keyword: '#859900',
      control: '#859900',
      name: '#586e75',
      function: '#268bd2',
      property: '#268bd2',
      type: '#b58900',
      number: '#d33682',
      string: '#2aa198',
      comment: '#93a1a1',
      tag: '#268bd2',
      attribute: '#b58900',
      link: '#268bd2',
      invalid: '#dc322f',
    },
  },
  'solarized-dark': {
    name: 'solarized-dark',
    label: 'Solarized Dark',
    dark: true,
    background: '#002b36',
    foreground: '#93a1a1',
    gutterBackground: '#00252e',
    gutterForeground: '#6d8189',
    activeLine: '#073642',
    selection: '#0e4b5a',
    selectionMatch: '#3f3a1e',
    selectionMatchBorder: '#9c8a3f',
    cursor: '#2aa198',
    matchingBracket: '#586e75',
    searchMatch: '#3f3a1e',
    searchMatchCurrent: '#8c7426',
    syntax: {
      keyword: '#859900',
      control: '#859900',
      name: '#93a1a1',
      function: '#268bd2',
      property: '#268bd2',
      type: '#b58900',
      number: '#d33682',
      string: '#2aa198',
      comment: '#586e75',
      tag: '#268bd2',
      attribute: '#b58900',
      link: '#268bd2',
      invalid: '#dc322f',
    },
  },
  contrast: {
    name: 'contrast',
    label: '高对比',
    dark: true,
    background: '#000000',
    foreground: '#ffffff',
    gutterBackground: '#0a0a0a',
    gutterForeground: '#b8b8b8',
    activeLine: '#1a1a1a',
    selection: '#2f6fb5',
    selectionMatch: '#6b4a00',
    selectionMatchBorder: '#ffd24a',
    cursor: '#ffffff',
    matchingBracket: '#8a6d00',
    searchMatch: '#6b4a00',
    searchMatchCurrent: '#a87900',
    syntax: {
      keyword: '#ff7b72',
      control: '#ff7b72',
      name: '#ffffff',
      function: '#79c0ff',
      property: '#79c0ff',
      type: '#ffa657',
      number: '#79c0ff',
      string: '#a5d6ff',
      comment: '#9aa4ae',
      tag: '#7ee787',
      attribute: '#ffa657',
      link: '#79c0ff',
      invalid: '#ff5555',
    },
  },
};

/** Adds alpha to a hex colour so highlights never hide the selection layer. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  if (full.length !== 6) return color;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return color;
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/** One highlight style per template, built from the same tag table. */
function highlightStyle(spec: ThemeSpec): HighlightStyle {
  const { syntax } = spec;
  return HighlightStyle.define([
    { tag: [t.keyword, t.modifier, t.operatorKeyword], color: syntax.keyword },
    { tag: [t.controlKeyword, t.moduleKeyword], color: syntax.control },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: syntax.name },
    { tag: [t.function(t.variableName), t.labelName], color: syntax.function },
    { tag: [t.propertyName], color: syntax.property },
    { tag: [t.typeName, t.className, t.namespace], color: syntax.type },
    { tag: [t.number, t.bool, t.null], color: syntax.number },
    { tag: [t.string, t.special(t.string)], color: syntax.string },
    {
      tag: [t.comment, t.lineComment, t.blockComment],
      color: syntax.comment,
      fontStyle: 'italic',
    },
    {
      tag: [t.definition(t.variableName), t.definition(t.propertyName)],
      color: syntax.function,
    },
    { tag: [t.tagName, t.angleBracket], color: syntax.tag },
    { tag: [t.attributeName], color: syntax.attribute },
    { tag: [t.heading, t.strong], fontWeight: 'bold' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.link, t.url], color: syntax.link, textDecoration: 'underline' },
    { tag: [t.invalid], color: syntax.invalid },
  ]);
}

const HIGHLIGHTS = new Map<ThemeName, HighlightStyle>();

function highlightFor(name: ThemeName): HighlightStyle {
  const cached = HIGHLIGHTS.get(name);
  if (cached) return cached;
  const style = highlightStyle(themeSpec(name));
  HIGHLIGHTS.set(name, style);
  return style;
}

export function themeSpec(name: ThemeName | undefined): ThemeSpec {
  return (name && THEMES[name]) || THEMES.light;
}

/** Editor chrome for a theme; the surrounding UI reads the same values from CSS. */
export function editorTheme(settings: AppSettings): Extension {
  const spec = themeSpec(settings.theme);
  return [
    EditorView.theme(
      {
        '&': {
          color: spec.foreground,
          backgroundColor: spec.background,
          height: '100%',
          fontSize: `${settings.fontSize}px`,
        },
        '.cm-content': {
          fontFamily: settings.fontFamily,
          caretColor: spec.cursor,
          padding: '6px 0',
        },
        '.cm-scroller': {
          fontFamily: settings.fontFamily,
          lineHeight: '1.55',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: spec.cursor },
        // Selection is painted by the browser (createState drops drawSelection),
        // so it covers the selected characters only, like Notepad++ does.
        '.cm-content ::selection, .cm-content::selection, .cm-line::selection': {
          backgroundColor: spec.selection,
        },
        '.cm-activeLine': { backgroundColor: spec.activeLine },
        // Keeps an empty line that a selection reaches from looking untouched
        // (see selectionEdge); declared after .cm-activeLine to win over it.
        '.cm-caret-line-selected': { backgroundColor: spec.selection },
        // Secondary ranges and carets of a multi-cursor state (multiRangePaint).
        '.cm-secondary-range': { backgroundColor: spec.selection },
        '.cm-secondary-caret': {
          position: 'relative',
          display: 'inline-block',
          width: '0',
          height: '1.2em',
          verticalAlign: 'text-bottom',
        },
        '.cm-secondary-caret::before': {
          content: '""',
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '1px',
          backgroundColor: spec.cursor,
        },
        // Notepad++ keeps the number margin tight: a few px each side only.
        '.cm-gutters': {
          backgroundColor: spec.gutterBackground,
          color: spec.gutterForeground,
          border: 'none',
          minWidth: '0',
        },
        '.cm-activeLineGutter': {
          backgroundColor: spec.activeLine,
          color: spec.foreground,
        },
        '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 4px' },
        '.cm-foldGutter .cm-gutterElement': { padding: '0 1px', fontSize: '0.85em' },
        '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
          backgroundColor: spec.matchingBracket,
          outline: `1px solid ${spec.matchingBracket}`,
        },
        // Match highlights stay translucent: mark backgrounds paint above the
        // selection layer, so an opaque colour would hide the selected text.
        '.cm-selectionMatch': {
          backgroundColor: withAlpha(spec.selectionMatch, 0.55),
          boxShadow: `inset 0 0 0 1px ${spec.selectionMatchBorder}`,
          borderRadius: '2px',
        },
        '.cm-searchMatch': {
          backgroundColor: withAlpha(spec.searchMatch, 0.5),
          outline: '1px solid transparent',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: withAlpha(spec.searchMatchCurrent, 0.7),
          outline: `1px solid ${spec.cursor}`,
          borderRadius: '2px',
        },
        '.cm-panels': {
          backgroundColor: spec.gutterBackground,
          color: spec.foreground,
        },
        '.cm-tooltip': {
          backgroundColor: spec.gutterBackground,
          border: `1px solid ${spec.gutterForeground}`,
        },
      },
      { dark: spec.dark },
    ),
    syntaxHighlighting(highlightFor(spec.name)),
  ];
}

/** Mirrors the theme on <html> so the surrounding UI can style itself in CSS. */
export function applyUiTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  const spec = themeSpec(theme);
  document.documentElement.dataset.theme = spec.name;
  document.documentElement.dataset.mode = spec.dark ? 'dark' : 'light';
}
