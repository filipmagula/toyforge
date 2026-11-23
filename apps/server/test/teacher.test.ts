import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yauzl from 'yauzl';
import { afterEach, describe, expect, it } from 'vitest';
import { createClass, makeTestApp } from './helpers';
import { multipart, type SubmissionFields } from './fixtures';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

async function submit(code: string, f: SubmissionFields = {}) {
  const { payload, headers } = await multipart(f);
  const res = await ctx.app.inject({ method: 'POST', url: `/api/classes/${code}/models`, payload, headers });
  return res.json() as { id: string };
}
const auth = (key: string) => ({ authorization: `Bearer ${key}` });

function unzip(buf: Buffer): Promise<Record<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      const out: Record<string, Buffer> = {};
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return reject(e2);
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => { out[entry.fileName] = Buffer.concat(chunks); zip.readEntry(); });
        });
      });
      zip.on('end', () => resolve(out));
      zip.readEntry();
    });
  });
}

describe('teacher class', () => {
  it('reports counts and expiry', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app, 'Robots');
    const a = await submit(c.code);
    await submit(c.code);
    await ctx.app.inject({ method: 'PATCH', url: `/api/teacher/models/${a.id}`, headers: auth(c.teacherKey), payload: { printStatus: 'printed' } });
    const res = await ctx.app.inject({ method: 'GET', url: '/api/teacher/class', headers: auth(c.teacherKey) });
    expect(res.json()).toMatchObject({ code: c.code, name: 'Robots', isOpen: true, counts: { total: 2, new: 1, queued: 0, printed: 1 }, expiresAt: '2026-12-23T10:00:00.000Z' });
  });
  it('closes and renames', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const res = await ctx.app.inject({ method: 'PATCH', url: '/api/teacher/class', headers: auth(c.teacherKey), payload: { isOpen: false, name: 'New name' } });
    expect(res.json()).toMatchObject({ isOpen: false, name: 'New name' });
    const { payload, headers } = await multipart();
    const sub = await ctx.app.inject({ method: 'POST', url: `/api/classes/${c.code}/models`, payload, headers });
    expect(sub.statusCode).toBe(409);
    const bad = await ctx.app.inject({ method: 'PATCH', url: '/api/teacher/class', headers: auth(c.teacherKey), payload: { name: 'x'.repeat(41) } });
    expect(bad.statusCode).toBe(400);
  });
  it('teacher activity extends expiry', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    ctx.clock.advanceDays(20);
    await ctx.app.inject({ method: 'PATCH', url: '/api/teacher/class', headers: auth(c.teacherKey), payload: { isOpen: true } });
    ctx.clock.advanceDays(20);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/classes/${c.code}` })).statusCode).toBe(200);
  });
  it('deletes the class with files', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    await submit(c.code);
    const cls = ctx.app.db.prepare('SELECT id FROM classes').get() as { id: string };
    const res = await ctx.app.inject({ method: 'DELETE', url: '/api/teacher/class', headers: auth(c.teacherKey) });
    expect(res.statusCode).toBe(204);
    expect(existsSync(join(ctx.dataDir, 'classes', cls.id))).toBe(false);
    expect((ctx.app.db.prepare('SELECT COUNT(*) n FROM models').get() as { n: number }).n).toBe(0);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/classes/${c.code}` })).statusCode).toBe(404);
  });
});

describe('teacher models', () => {
  it('lists newest first with recipe, filters by status', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const a = await submit(c.code, { makerName: 'Ann' });
    ctx.clock.advanceDays(1);
    const b = await submit(c.code, { makerName: 'Ben' });
    const all = (await ctx.app.inject({ method: 'GET', url: '/api/teacher/models?status=all', headers: auth(c.teacherKey) })).json();
    expect(all.map((m: { id: string }) => m.id)).toEqual([b.id, a.id]);
    expect(all[0]).toMatchObject({ makerName: 'Ben', characterName: 'Robot', printStatus: 'new', stlSizeBytes: 684, triangleCount: 12 });
    expect(all[0].recipe.version).toBe(1);
    await ctx.app.inject({ method: 'PATCH', url: `/api/teacher/models/${a.id}`, headers: auth(c.teacherKey), payload: { printStatus: 'queued' } });
    const queued = (await ctx.app.inject({ method: 'GET', url: '/api/teacher/models?status=queued', headers: auth(c.teacherKey) })).json();
    expect(queued.map((m: { id: string }) => m.id)).toEqual([a.id]);
  });
  it('isolates classes', async () => {
    ctx = await makeTestApp();
    const a = await createClass(ctx.app, 'a');
    const b = await createClass(ctx.app, 'b');
    const m = await submit(a.code);
    for (const [method, url] of [['GET', `/api/teacher/models/${m.id}/stl`], ['GET', `/api/teacher/models/${m.id}/thumbnail`], ['DELETE', `/api/teacher/models/${m.id}`]] as const) {
      const res = await ctx.app.inject({ method, url, headers: auth(b.teacherKey) });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('not_found');
    }
    expect((await ctx.app.inject({ method: 'GET', url: '/api/teacher/models?status=all', headers: auth(b.teacherKey) })).json()).toEqual([]);
  });
  it('validates print status', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const m = await submit(c.code);
    expect((await ctx.app.inject({ method: 'PATCH', url: `/api/teacher/models/${m.id}`, headers: auth(c.teacherKey), payload: { printStatus: 'archived' } })).statusCode).toBe(400);
    const ok = await ctx.app.inject({ method: 'PATCH', url: `/api/teacher/models/${m.id}`, headers: auth(c.teacherKey), payload: { printStatus: 'printed' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().printStatus).toBe('printed');
  });
  it('downloads stl and thumbnail', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const m = await submit(c.code, { makerName: 'Łukasz', characterName: 'Captain Tentacle' });
    const stl = await ctx.app.inject({ method: 'GET', url: `/api/teacher/models/${m.id}/stl`, headers: auth(c.teacherKey) });
    expect(stl.statusCode).toBe(200);
    expect(stl.headers['content-type']).toBe('model/stl');
    expect(stl.headers['content-disposition']).toContain(`filename="lukasz_captain_tentacle_${m.id.slice(0, 4)}.stl"`);
    expect(stl.rawPayload.length).toBe(684);
    const png = await ctx.app.inject({ method: 'GET', url: `/api/teacher/models/${m.id}/thumbnail`, headers: auth(c.teacherKey) });
    expect(png.headers['content-type']).toBe('image/png');
  });
  it('deletes a model and its files', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const m = await submit(c.code);
    const cls = ctx.app.db.prepare('SELECT id FROM classes').get() as { id: string };
    const res = await ctx.app.inject({ method: 'DELETE', url: `/api/teacher/models/${m.id}`, headers: auth(c.teacherKey) });
    expect(res.statusCode).toBe(204);
    expect(existsSync(ctx.app.storage.modelPaths(cls.id, m.id).stl)).toBe(false);
  });
});

describe('zip download', () => {
  async function token(key: string, status: 'new' | 'all', markAsQueued: boolean) {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/teacher/download-token', headers: auth(key), payload: { status, markAsQueued } });
    expect(res.statusCode).toBe(200);
    return res.json().url as string;
  }
  it('streams stls and manifest, marks queued, single-use token', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const a = await submit(c.code, { makerName: 'Maya', characterName: 'Robot' });
    const b = await submit(c.code, { makerName: 'Maya', characterName: 'Robot' });
    const p = await submit(c.code, { makerName: 'Zed' });
    await ctx.app.inject({ method: 'PATCH', url: `/api/teacher/models/${p.id}`, headers: auth(c.teacherKey), payload: { printStatus: 'printed' } });
    const url = await token(c.teacherKey, 'new', true);
    expect(url).toMatch(/^\/api\/teacher\/models\.zip\?token=/);
    const res = await ctx.app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain(`toyforge_${c.code}_2026-11-23.zip`);
    const files = await unzip(res.rawPayload);
    const names = Object.keys(files).sort();
    expect(names).toEqual(['manifest.csv', `maya_robot_${a.id.slice(0, 4)}.stl`, `maya_robot_${b.id.slice(0, 4)}.stl`].sort());
    const manifest = files['manifest.csv']!.toString('utf8');
    expect(manifest.startsWith('﻿maker_name,character_name,created_at,status,filename')).toBe(true);
    expect(manifest).toContain('Maya,Robot,');
    const list = (await ctx.app.inject({ method: 'GET', url: '/api/teacher/models?status=all', headers: auth(c.teacherKey) })).json() as { id: string; printStatus: string }[];
    expect(Object.fromEntries(list.map((m) => [m.id, m.printStatus]))).toEqual({ [a.id]: 'queued', [b.id]: 'queued', [p.id]: 'printed' });
    expect((await ctx.app.inject({ method: 'GET', url })).statusCode).toBe(404);
  });
  it('all includes printed and expired tokens fail', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    await submit(c.code);
    const url = await token(c.teacherKey, 'all', false);
    ctx.clock.set(new Date(Date.parse('2026-11-23T10:01:01Z')));
    expect((await ctx.app.inject({ method: 'GET', url })).statusCode).toBe(404);
    const url2 = await token(c.teacherKey, 'all', false);
    const files = await unzip((await ctx.app.inject({ method: 'GET', url: url2 })).rawPayload);
    expect(Object.keys(files)).toHaveLength(2);
  });
  it('requires bearer for the token', async () => {
    ctx = await makeTestApp();
    expect((await ctx.app.inject({ method: 'POST', url: '/api/teacher/download-token', payload: { status: 'all' } })).statusCode).toBe(401);
  });
});
