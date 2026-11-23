import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: ['safari16', 'chrome110', 'firefox115'],
    // CSP is font-src 'self': never inline fonts as data: URIs (the latin-ext subset carries č/ř/ł/ż).
    assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        teacher: resolve(import.meta.dirname, 'teacher.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node', include: ['test/**/*.test.ts'], exclude: ['e2e/**'] },
});
