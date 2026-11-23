import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'toyforge-e2e-'));
const PORT = 3101;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, acceptDownloads: true },
  projects: [
    { name: 'ipad-webkit', use: { ...devices['iPad (gen 7)'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run build && cd ../server && npm run build && node dist/main.js`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT), DATA_DIR: dataDir, PUBLIC_URL: `http://localhost:${PORT}`, WEB_DIST: '../web/dist', TRUST_PROXY: 'false' },
  },
});
