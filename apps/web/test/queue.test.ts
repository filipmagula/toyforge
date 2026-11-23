import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BLANK_RECIPE } from '@toyforge/shared';
import { openQueue, type Submission } from '../src/net/queue';
import { createSync } from '../src/net/sync';
import { sendSubmission } from '../src/net/api';

let n = 0;
function sub(over: Partial<Submission> = {}): Submission {
  n++;
  return {
    submissionId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    code: 'KQMTRB',
    makerName: 'Maya',
    characterName: 'Robot',
    recipe: BLANK_RECIPE,
    stl: new Uint8Array([1, 2, 3]).buffer,
    thumbnail: new Uint8Array([4]).buffer,
    createdAt: '2026-11-23T10:00:00Z',
    ...over,
  };
}

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;
function fakeFetch(handler: Handler) {
  const calls: { url: string; body: FormData }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as FormData });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ok = () => json(201, { id: 'x', makerName: 'Maya', characterName: 'Robot', createdAt: '2026-11-23T10:00:00Z' });
let dbName = '';
beforeEach(() => { dbName = `q${Math.random()}`; });

describe('sendSubmission', () => {
  it('posts multipart to the class endpoint', async () => {
    const { f, calls } = fakeFetch(() => ok());
    const s = sub();
    const r = await sendSubmission(s, f);
    expect(r.kind).toBe('sent');
    expect(calls[0]!.url).toBe('/api/classes/KQMTRB/models');
    const fd = calls[0]!.body;
    expect(fd.get('submissionId')).toBe(s.submissionId);
    expect(fd.get('makerName')).toBe('Maya');
    expect(JSON.parse(fd.get('recipeJson') as string).version).toBe(1);
    expect((fd.get('stlFile') as File).size).toBe(3);
  });
  it('classifies failures', async () => {
    expect((await sendSubmission(sub(), fakeFetch(() => { throw new TypeError('offline'); }).f)).kind).toBe('retry');
    expect((await sendSubmission(sub(), fakeFetch(() => json(503, {})).f)).kind).toBe('retry');
    expect((await sendSubmission(sub(), fakeFetch(() => json(429, { error: 'rate_limited' })).f)).kind).toBe('retry');
    expect(await sendSubmission(sub(), fakeFetch(() => json(409, { error: 'class_closed', message: '' })).f)).toEqual({ kind: 'rejected', error: 'class_closed' });
    expect(await sendSubmission(sub(), fakeFetch(() => new Response('nope', { status: 400 })).f)).toEqual({ kind: 'rejected', error: 'validation' });
  });
  it('treats 200 (already stored) as sent', async () => {
    const r = await sendSubmission(sub(), fakeFetch(() => json(200, { id: 'x' })).f);
    expect(r.kind).toBe('sent');
  });
});

describe('sync', () => {
  it('sends immediately when online', async () => {
    const q = await openQueue(dbName);
    const sync = createSync(q, (s) => sendSubmission(s, fakeFetch(() => ok()).f));
    expect((await sync.submitOrQueue(sub())).kind).toBe('sent');
    expect(await q.all()).toEqual([]);
  });
  it('queues when offline and survives reopening', async () => {
    const q = await openQueue(dbName);
    const offline = createSync(q, (s) => sendSubmission(s, fakeFetch(() => { throw new TypeError('offline'); }).f));
    const s = sub();
    expect((await offline.submitOrQueue(s)).kind).toBe('queued');
    expect(await offline.pendingCount()).toBe(1);
    const reopened = await openQueue(dbName);
    const stored = await reopened.all();
    expect(stored.map((x) => x.submissionId)).toEqual([s.submissionId]);
    expect(new Uint8Array(stored[0]!.stl)).toEqual(new Uint8Array([1, 2, 3]));
    const online = createSync(reopened, (x) => sendSubmission(x, fakeFetch(() => ok()).f));
    await online.flush();
    expect(await reopened.all()).toEqual([]);
  });
  it('clears an item whose retry finds it already stored', async () => {
    const q = await openQueue(dbName);
    let attempt = 0;
    const sync = createSync(q, (s) => sendSubmission(s, fakeFetch(() => {
      attempt++;
      if (attempt === 1) throw new TypeError('response lost');
      return json(200, { id: s.submissionId });
    }).f));
    await sync.submitOrQueue(sub());
    await sync.flush();
    expect(await q.all()).toEqual([]);
  });
  it('stops retrying a queued item the server rejects, keeps it downloadable', async () => {
    const q = await openQueue(dbName);
    await createSync(q, (s) => sendSubmission(s, fakeFetch(() => { throw new TypeError('offline'); }).f)).submitOrQueue(sub());
    const calls: string[] = [];
    const sync = createSync(q, (s) => { calls.push(s.submissionId); return sendSubmission(s, fakeFetch(() => json(404, { error: 'class_not_found' })).f); });
    await sync.flush();
    await sync.flush();
    expect(calls).toHaveLength(1);
    const items = await q.all();
    expect(items[0]!.rejected).toBe('class_not_found');
    expect(items[0]!.stl.byteLength).toBe(3);
    expect(await sync.pendingCount()).toBe(0);
  });
  it('drops an item rejected on the immediate send', async () => {
    const q = await openQueue(dbName);
    const sync = createSync(q, (s) => sendSubmission(s, fakeFetch(() => json(409, { error: 'class_closed' })).f));
    expect(await sync.submitOrQueue(sub())).toEqual({ kind: 'rejected', error: 'class_closed' });
    expect(await q.all()).toEqual([]);
  });
  it('notifies listeners on change', async () => {
    const q = await openQueue(dbName);
    const sync = createSync(q, (s) => sendSubmission(s, fakeFetch(() => { throw new TypeError('x'); }).f));
    let changes = 0;
    sync.onChange(() => changes++);
    await sync.submitOrQueue(sub());
    expect(changes).toBeGreaterThan(0);
  });
});

describe('stalled uploads', () => {
  it('time out and are retried later', async () => {
    const hang = ((_url: string, init: RequestInit) => new Promise<Response>((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(new DOMException('timeout', 'TimeoutError')));
    })) as unknown as typeof fetch;
    const started = Date.now();
    const r = await sendSubmission(sub(), hang, { timeoutMs: 50 });
    expect(r.kind).toBe('retry');
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
