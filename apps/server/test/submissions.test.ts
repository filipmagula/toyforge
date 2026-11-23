import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createClass, makeTestApp } from './helpers';
import { makePng, makeStl, multipart, type SubmissionFields } from './fixtures';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

async function submit(code: string, f: SubmissionFields = {}, ip = '10.1.1.1') {
  const { payload, headers } = await multipart(f);
  return ctx.app.inject({ method: 'POST', url: `/api/classes/${code}/models`, payload, headers, remoteAddress: ip });
}

describe('POST /api/classes/:code/models', () => {
  it('stores a valid submission', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    ctx.clock.advanceDays(2);
    const id = randomUUID();
    const res = await submit(c.code, { submissionId: id, makerName: ' Šimon ', characterName: '' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id, makerName: 'Šimon', characterName: 'Untitled Creature' });
    const cls = ctx.app.db.prepare('SELECT * FROM classes WHERE code = ?').get(c.code) as { id: string; last_activity_at: string };
    expect(cls.last_activity_at).toBe('2026-11-25T10:00:00.000Z');
    const p = ctx.app.storage.modelPaths(cls.id, id);
    expect(existsSync(p.stl) && existsSync(p.png)).toBe(true);
    const row = ctx.app.db.prepare('SELECT * FROM models WHERE id = ?').get(id) as { triangle_count: number; stl_size_bytes: number; print_status: string };
    expect(row).toMatchObject({ triangle_count: 12, stl_size_bytes: 84 + 600, print_status: 'new' });
  });

  it('is idempotent for the same submissionId', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const id = randomUUID();
    expect((await submit(c.code, { submissionId: id })).statusCode).toBe(201);
    const again = await submit(c.code, { submissionId: id });
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(id);
    expect((ctx.app.db.prepare('SELECT COUNT(*) n FROM models').get() as { n: number }).n).toBe(1);
  });

  it('rejects reuse of a submissionId in another class', async () => {
    ctx = await makeTestApp();
    const a = await createClass(ctx.app, 'a');
    const b = await createClass(ctx.app, 'b');
    const id = randomUUID();
    await submit(a.code, { submissionId: id });
    const res = await submit(b.code, { submissionId: id });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it.each<[string, SubmissionFields]>([
    ['missing maker', { makerName: '' }],
    ['emoji maker', { makerName: 'Bob🙂' }],
    ['bad recipe', { recipeJson: '{"version":2}' }],
    ['non-json recipe', { recipeJson: 'nope' }],
    ['bad stl length', { stl: makeStl(12).subarray(0, 500) }],
    ['missing stl', { stl: null }],
    ['missing thumbnail', { png: null }],
    ['huge thumbnail dimensions', { png: makePng(2048, 2048) }],
    ['bad submissionId', { submissionId: 'abc' }],
  ])('rejects %s with 400', async (_n, f) => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const res = await submit(c.code, f);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
    expect((ctx.app.db.prepare('SELECT COUNT(*) n FROM models').get() as { n: number }).n).toBe(0);
  });

  it('rejects an STL over 10 MB with 413', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const res = await submit(c.code, { stl: makeStl(210_000) });
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe('too_large');
  });

  it('rejects closed, unknown, expired and full classes', async () => {
    ctx = await makeTestApp({ maxModelsPerClass: 3 });
    const c = await createClass(ctx.app);
    expect((await submit('ABCDEF')).json().error).toBe('class_not_found');
    for (let i = 0; i < 3; i++) expect((await submit(c.code)).statusCode).toBe(201);
    const full = await submit(c.code);
    expect(full.statusCode).toBe(409);
    expect(full.json().error).toBe('class_full');
    ctx.app.db.prepare('UPDATE classes SET is_open = 0').run();
    const closed = await submit(c.code);
    expect(closed.statusCode).toBe(409);
    expect(closed.json().error).toBe('class_closed');
    ctx.clock.advanceDays(31);
    expect((await submit(c.code)).statusCode).toBe(404);
  });

  it('lets a whole classroom behind one IP submit', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    for (let i = 0; i < 30; i++) expect((await submit(c.code, {}, '10.9.9.9')).statusCode).toBe(201);
  });

  it('rate limits one IP at 60/min', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    for (let i = 0; i < 60; i++) await submit(c.code, {}, '10.8.8.8');
    const res = await submit(c.code, {}, '10.8.8.8');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
  });
});

describe('concurrent duplicate submission', () => {
  it('keeps one record and its files', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const id = randomUUID();
    const [a, b] = await Promise.all([submit(c.code, { submissionId: id }), submit(c.code, { submissionId: id })]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    const cls = ctx.app.db.prepare('SELECT id FROM classes').get() as { id: string };
    const p = ctx.app.storage.modelPaths(cls.id, id);
    expect(existsSync(p.stl)).toBe(true);
  });
});
