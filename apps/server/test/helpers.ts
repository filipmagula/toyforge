import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app';
import { loadConfig, type Config } from '../src/config';

export async function makeTestApp(overrides: Partial<Config> = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'toyforge-test-'));
  const config: Config = { ...loadConfig({}), dataDir, publicUrl: 'https://toyforge.test', ...overrides };
  let current = new Date('2026-11-23T10:00:00Z');
  const clock = { set: (d: Date) => { current = d; }, advanceDays: (n: number) => { current = new Date(current.getTime() + n * 86400000); } };
  const app = await buildApp(config, { now: () => current });
  return { app, config, dataDir, clock };
}

export async function createClass(app: Awaited<ReturnType<typeof makeTestApp>>['app'], name = 'Test', ip = '10.0.0.1') {
  const res = await app.inject({ method: 'POST', url: '/api/classes', payload: { name }, remoteAddress: ip });
  if (res.statusCode !== 201) throw new Error(`create failed ${res.statusCode} ${res.body}`);
  return res.json() as { code: string; teacherKey: string; name: string; kidUrl: string; teacherUrl: string; expiresAt: string };
}
