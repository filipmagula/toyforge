import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';

// The production CSP is `font-src 'self'`, so fonts must be emitted as files, never inlined as data: URIs.
describe('production build', () => {
  it('emits all font subsets (incl. latin-ext for cs/pl) as files', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'toyforge-build-'));
    await build({ root: join(import.meta.dirname, '..'), logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const assets = readdirSync(join(outDir, 'assets'));
    const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(outDir, 'assets', f), 'utf8')).join('\n');
    expect(css).not.toMatch(/url\(\s*["']?data:font/);
    expect(assets.some((f) => /latin-ext-400.*\.woff2$/.test(f))).toBe(true);
  }, 60_000);
});
