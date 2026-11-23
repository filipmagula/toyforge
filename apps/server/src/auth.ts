import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isExpired, type ClassRow } from './db';
import { sendError, WindowCounter } from './errors';

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateTeacherKey(): string {
  return randomBytes(32).toString('base64url');
}

const failed = new WindowCounter(60_000, 20);

export async function requireTeacher(this: unknown, request: FastifyRequest, reply: FastifyReply) {
  const app = request.server;
  const now = app.now();
  if (failed.blocked(request.ip, now.getTime())) {
    return sendError(reply, 429, 'rate_limited', 'Too many attempts. Try again in a minute.');
  }
  const header = request.headers.authorization ?? '';
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(header);
  const row = m ? (app.db.prepare('SELECT * FROM classes WHERE teacher_key_hash = ?').get(hashKey(m[1]!)) as ClassRow | undefined) : undefined;
  const ok = !!row && timingSafeEqual(Buffer.from(row.teacher_key_hash), Buffer.from(hashKey(m![1]!))) && !isExpired(row, now, app.config.retentionDays);
  if (!ok) {
    failed.hit(request.ip, now.getTime());
    return sendError(reply, 401, 'unauthorized', 'This teacher link is not valid.');
  }
  request.teacherClass = row;
}
