import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { makeTestApp } from './helpers';

let ctx: Awaited<ReturnType<typeof makeTestApp>>;
afterEach(async () => { await ctx?.app.close(); });

describe('behind the trusted proxy', () => {
  it('parses a comma separated TRUST_PROXY list', () => {
    expect(loadConfig({ TRUST_PROXY: 'loopback,172.31.250.0/24' }).trustProxy).toBe('loopback,172.31.250.0/24');
  });
  it('rate limits per forwarded client IP, not per proxy', async () => {
    ctx = await makeTestApp({ trustProxy: 'loopback,172.31.250.0/24' });
    for (let i = 0; i < 12; i++) {
      const res = await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: {}, remoteAddress: '172.31.250.1', headers: { 'x-forwarded-for': `203.0.113.${i}` } });
      expect(res.statusCode).toBe(201);
    }
  });
  it('ignores X-Forwarded-For from untrusted peers', async () => {
    ctx = await makeTestApp({ trustProxy: 'loopback,172.31.250.0/24' });
    for (let i = 0; i < 10; i++) {
      await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: {}, remoteAddress: '198.51.100.7', headers: { 'x-forwarded-for': `203.0.113.${i}` } });
    }
    const res = await ctx.app.inject({ method: 'POST', url: '/api/classes', payload: {}, remoteAddress: '198.51.100.7', headers: { 'x-forwarded-for': '203.0.113.99' } });
    expect(res.statusCode).toBe(429);
  });
});
