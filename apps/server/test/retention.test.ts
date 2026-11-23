import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { purgeExpired } from '../src/retention';
import { createClass, makeTestApp } from './helpers';
import { multipart } from './fixtures';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

async function classWithModel(name: string) {
  const c = await createClass(ctx.app, name);
  const { payload, headers } = await multipart();
  await ctx.app.inject({ method: 'POST', url: `/api/classes/${c.code}/models`, payload, headers });
  return (ctx.app.db.prepare('SELECT id FROM classes WHERE code = ?').get(c.code) as { id: string }).id;
}

describe('purgeExpired', () => {
  it('deletes only classes inactive beyond retention, with files', async () => {
    ctx = await makeTestApp();
    const old = await classWithModel('old');
    ctx.clock.advanceDays(2);
    const fresh = await classWithModel('fresh');
    const now = new Date(Date.parse('2026-11-23T10:00:00Z') + 30.5 * 86400000);
    const n = await purgeExpired(ctx.app.db, ctx.app.storage, now, 30);
    expect(n).toBe(1);
    expect(existsSync(join(ctx.dataDir, 'classes', old))).toBe(false);
    expect(existsSync(join(ctx.dataDir, 'classes', fresh))).toBe(true);
    const ids = (ctx.app.db.prepare('SELECT id FROM classes').all() as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual([fresh]);
    expect((ctx.app.db.prepare('SELECT COUNT(*) n FROM models').get() as { n: number }).n).toBe(1);
  });
  it('removes orphan class directories', async () => {
    ctx = await makeTestApp();
    const orphan = join(ctx.dataDir, 'classes', randomUUID());
    await mkdir(orphan, { recursive: true });
    await purgeExpired(ctx.app.db, ctx.app.storage, new Date(), 30);
    expect(existsSync(orphan)).toBe(false);
  });
});
