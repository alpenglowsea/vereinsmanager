import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COLOR_SCHEMES, FONT_CHOICES, istFarbschema, istSchriftwahl } from './appearance';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const fontsTs = readFileSync(new URL('../fonts.ts', import.meta.url), 'utf8');

describe('Farbschemata und Schriften', () => {
  it('erkennt gültige und ungültige Werte', () => {
    expect(istFarbschema('gruen')).toBe(true);
    expect(istFarbschema('pink')).toBe(false);
    expect(istFarbschema(undefined)).toBe(false);
    expect(istSchriftwahl('lora')).toBe(true);
    expect(istSchriftwahl('comic')).toBe(false);
  });

  it('jedes Farbschema außer Blau hat seinen Block in index.css', () => {
    for (const s of COLOR_SCHEMES.filter(c => c.id !== 'blau')) {
      expect(css).toContain(`:root[data-farbschema="${s.id}"] {`);
    }
  });

  it('jede Schrift außer der Systemschrift ist in index.css und fonts.ts hinterlegt', () => {
    for (const f of FONT_CHOICES.filter(x => x.id !== 'system')) {
      expect(css).toContain(`:root[data-schrift="${f.id}"] {`);
    }
    expect(fontsTs).toContain('@fontsource/source-sans-3/latin-400.css');
    expect(fontsTs).toContain('@fontsource/chakra-petch/latin-400.css');
    expect(fontsTs).toContain('@fontsource/lora/latin-400.css');
  });

  it('jedes Farbschema definiert alle Stufen von blue und indigo', () => {
    for (const s of COLOR_SCHEMES.filter(c => c.id !== 'blau')) {
      const start = css.indexOf(`:root[data-farbschema="${s.id}"] {`);
      const block = css.slice(start, css.indexOf('}', start));
      for (const fam of ['blue', 'indigo']) {
        for (const stufe of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
          expect(block).toContain(`--color-${fam}-${stufe}:`);
        }
      }
    }
  });
});
