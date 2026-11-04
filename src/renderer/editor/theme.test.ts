import { describe, expect, it } from 'vitest';

import { THEME_ORDER, THEMES, themeSpec } from '@renderer/editor/theme';

const CHROME_KEYS = [
  'background',
  'foreground',
  'gutterBackground',
  'gutterForeground',
  'activeLine',
  'selection',
  'selectionMatch',
  'selectionMatchBorder',
  'cursor',
  'matchingBracket',
  'searchMatch',
  'searchMatchCurrent',
] as const;

const HEX = /^#[0-9a-f]{6}$/i;

describe('theme templates', () => {
  it('lists every template exactly once', () => {
    expect(THEME_ORDER).toHaveLength(Object.keys(THEMES).length);
    expect(new Set(THEME_ORDER).size).toBe(THEME_ORDER.length);
    for (const name of THEME_ORDER) {
      expect(THEMES[name], name).toBeDefined();
      expect(THEMES[name].name).toBe(name);
    }
  });

  it('ships light and dark templates', () => {
    expect(THEME_ORDER.filter((name) => THEMES[name].dark).length).toBeGreaterThan(1);
    expect(THEME_ORDER.filter((name) => !THEMES[name].dark).length).toBeGreaterThan(0);
    expect(THEMES.contrast.dark).toBe(true);
  });

  it('gives every template a complete palette', () => {
    for (const name of THEME_ORDER) {
      const spec = THEMES[name];
      for (const key of CHROME_KEYS) {
        expect(spec[key], `${name}.${key}`).toMatch(HEX);
      }
      for (const [role, value] of Object.entries(spec.syntax)) {
        expect(value, `${name}.syntax.${role}`).toMatch(HEX);
      }
    }
  });

  it('falls back to the light template for unknown names', () => {
    expect(themeSpec(undefined).name).toBe('light');
    expect(themeSpec('missing' as never).name).toBe('light');
  });
});
