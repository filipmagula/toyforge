import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registerStatic } from '../src/static';
import { makeTestApp } from './helpers';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

async function dist() {
  const d = await mkdtemp(join(tmpdir(), 'toyforge-web-'));
  await writeFile(join(d, 'index.html'), '<h1>builder</h1>');
  await writeFile(join(d, 'teacher.html'), '<h1>teacher</h1>');
  await writeFile(join(d, 'privacy.html'), '<h1>privacy</h1>');
  await mkdir(join(d, 'assets'));
  await writeFile(join(d, 'assets', 'app-abc.js'), 'x');
  return d;
}

describe('static serving', () => {
  it('serves pages and assets', async () => {
    ctx = await makeTestApp();
    await registerStatic(ctx.app, await dist());
    const root = await ctx.app.inject({ method: 'GET', url: '/?class=ABCDEF' });
    expect(root.body).toContain('builder');
    expect(root.headers['cache-control']).toBe('no-cache');
    expect((await ctx.app.inject({ method: 'GET', url: '/teacher' })).body).toContain('teacher');
    expect((await ctx.app.inject({ method: 'GET', url: '/privacy' })).body).toContain('privacy');
    const asset = await ctx.app.inject({ method: 'GET', url: '/assets/app-abc.js' });
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });
  it('keeps API 404s as JSON', async () => {
    ctx = await makeTestApp();
    await registerStatic(ctx.app, await dist());
    const res = await ctx.app.inject({ method: 'GET', url: '/api/unknown' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });
});

describe('trailing slashes', () => {
  it('serves /teacher/ and /privacy/', async () => {
    ctx = await makeTestApp();
    await registerStatic(ctx.app, await dist());
    expect((await ctx.app.inject({ method: 'GET', url: '/teacher/' })).body).toContain('teacher');
    expect((await ctx.app.inject({ method: 'GET', url: '/privacy/' })).body).toContain('privacy');
  });
});
