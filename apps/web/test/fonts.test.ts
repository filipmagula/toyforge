import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import { cs } from '../src/i18n/cs';
import { pl } from '../src/i18n/pl';

const require = createRequire(import.meta.url);
const css = readFileSync(join(import.meta.dirname, '../src/styles.css'), 'utf8');
const imports = [...css.matchAll(/@import '(@fontsource\/[^/]+)\/(\d+)\.css'/g)].map((m) => ({ pkg: m[1]!, weight: m[2]! }));

// Every letter Czech and Polish use, plus every character in the cs/pl catalogues.
const REQUIRED = new Set([...'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽąćęłńóśźżĄĆĘŁŃÓŚŹŻ„“”–…', ...Object.values(cs).join(''), ...Object.values(pl).join('')]);

describe('bundled UI font', () => {
  it('is imported in several weights', () => expect(imports.length).toBeGreaterThanOrEqual(3));
  for (const { pkg, weight } of imports) {
    it(`${pkg} ${weight} has a glyph for every Czech and Polish character`, () => {
      const dir = join(dirname(require.resolve(`${pkg}/package.json`)), 'files');
      const files = readdirSync(dir).filter((f) => f.endsWith(`-${weight}-normal.woff2`));
      const covered = new Set<number>();
      for (const f of files) {
        const font = fontkit.create(readFileSync(join(dir, f))) as fontkit.Font;
        for (const cp of font.characterSet) covered.add(cp);
      }
      const missing = [...REQUIRED].filter((c) => c.trim() && !covered.has(c.codePointAt(0)!));
      expect(missing.join('')).toBe('');
    });
  }
});
