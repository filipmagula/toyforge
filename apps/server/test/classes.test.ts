import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createClass, makeTestApp } from './helpers';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

describe('POST /api/classes', () => {
  it('creates a class with code, key and links', async () => {
    ctx = await makeTestApp();
    const body = await createClass(ctx.app, '3B Robotics');
    expect(body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(body.teacherKey).toHaveLength(43);
    expect(body.name).toBe('3B Robotics');
    expect(body.kidUrl).toBe(`https://toyforge.test/?class=${body.code}`);
    expect(body.teacherUrl).toBe(`https://toyforge.test/teacher#key=${body.teacherKey}`);
    expect(body.expiresAt).toBe('2026-12-23T10:00:00.000Z');
  });
  it('stores only the key hash', async () => {
    ctx = await makeTestApp();
    const body = await createClass(ctx.app);
    const row = ctx.app.db.prepare('SELECT teacher_key_hash FROM classes WHERE code = ?').get(body.code) as { teacher_key_hash: string };
    expect(row.teacher_key_hash).toBe(createHash('sha256').update(body.teacherKey).digest('hex'));
    const all = JSON.stringify(ctx.app.db.prepare('SELECT * FROM classes').all());
    expect(all).not.toContain(body.teacherKey);
  });
  it('accepts a missing body', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'POST', url: '/api/classes' });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('');
  });
  it('rejects a too long name', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: { name: 'x'.repeat(41) } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });
  it('rate limits class creation to 10/hour per IP', async () => {
    ctx = await makeTestApp();
    for (let i = 0; i < 10; i++) await createClass(ctx.app, 'c', '10.0.0.9');
    const res = await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: {}, remoteAddress: '10.0.0.9' });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    const other = await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: {}, remoteAddress: '10.0.0.10' });
    expect(other.statusCode).toBe(201);
  });
});

describe('GET /api/classes/:code', () => {
  it('finds a class with sloppy input', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app, 'Saturday');
    const sloppy = `${c.code.slice(0, 3).toLowerCase()}-${c.code.slice(3).toLowerCase()}`;
    const res = await ctx.app.inject({ method: 'GET', url: `/api/classes/${sloppy}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ code: c.code, name: 'Saturday', isOpen: true });
  });
  it('404s unknown and invalid codes', async () => {
    ctx = await makeTestApp();
    expect((await ctx.app.inject({ method: 'GET', url: '/api/classes/ABCDEF' })).json().error).toBe('class_not_found');
    expect((await ctx.app.inject({ method: 'GET', url: '/api/classes/0000' })).statusCode).toBe(404);
  });
  it('treats expired classes as missing', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    ctx.clock.advanceDays(31);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/classes/${c.code}` })).statusCode).toBe(404);
  });
});

describe('teacher auth', () => {
  it('rejects missing and wrong keys', async () => {
    ctx = await makeTestApp();
    await createClass(ctx.app);
    const none = await ctx.app.inject({ method: 'GET', url: '/api/teacher/class' });
    expect(none.statusCode).toBe(401);
    expect(none.json().error).toBe('unauthorized');
    const wrong = await ctx.app.inject({ method: 'GET', url: '/api/teacher/class', headers: { authorization: 'Bearer nope' } });
    expect(wrong.statusCode).toBe(401);
  });
  it('accepts the right key', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    const res = await ctx.app.inject({ method: 'GET', url: '/api/teacher/class', headers: { authorization: `Bearer ${c.teacherKey}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toBe(c.code);
  });
  it('rejects the key of an expired class', async () => {
    ctx = await makeTestApp();
    const c = await createClass(ctx.app);
    ctx.clock.advanceDays(31);
    const res = await ctx.app.inject({ method: 'GET', url: '/api/teacher/class', headers: { authorization: `Bearer ${c.teacherKey}` } });
    expect(res.statusCode).toBe(401);
  });
});

describe('health', () => {
  it('reports ok', async () => {
    ctx = await makeTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
