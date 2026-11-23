import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { generateClassCode, normalizeClassCode, validateName, type ClassInfo, type CreateClassResponse } from '@toyforge/shared';
import { generateTeacherKey, hashKey } from '../auth';
import { expiresAt, isExpired, type ClassRow } from '../db';
import { sendError } from '../errors';

export function findActiveClass(app: FastifyInstance, rawCode: string): ClassRow | null {
  const code = normalizeClassCode(rawCode);
  if (!code) return null;
  const row = app.db.prepare('SELECT * FROM classes WHERE code = ?').get(code) as ClassRow | undefined;
  if (!row || isExpired(row, app.now(), app.config.retentionDays)) return null;
  return row;
}

export async function classRoutes(app: FastifyInstance) {
  app.post('/api/classes', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const body = (req.body ?? {}) as { name?: unknown };
    const name = validateName('className', typeof body.name === 'string' ? body.name : '');
    if (!name.ok) return sendError(reply, 400, 'validation', `Class name: ${name.error}`);
    const now = app.now().toISOString();
    const teacherKey = generateTeacherKey();
    const insert = app.db.prepare(
      'INSERT INTO classes (id, code, name, teacher_key_hash, is_open, created_at, last_activity_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    );
    let code = '';
    for (let attempt = 0; ; attempt++) {
      code = generateClassCode((n) => randomBytes(n));
      try {
        insert.run(randomUUID(), code, name.value, hashKey(teacherKey), now, now);
        break;
      } catch (e) {
        if (attempt > 20 || !String(e).includes('UNIQUE')) throw e;
      }
    }
    const res: CreateClassResponse = {
      code,
      name: name.value,
      teacherKey,
      kidUrl: `${app.config.publicUrl}/?class=${code}`,
      teacherUrl: `${app.config.publicUrl}/teacher#key=${teacherKey}`,
      expiresAt: expiresAt({ last_activity_at: now }, app.config.retentionDays),
    };
    return reply.code(201).send(res);
  });

  app.get<{ Params: { code: string } }>('/api/classes/:code', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const row = findActiveClass(app, req.params.code);
    if (!row) return sendError(reply, 404, 'class_not_found', 'Class not found.');
    const res: ClassInfo = { code: row.code, name: row.name, isOpen: !!row.is_open };
    return res;
  });

  app.get('/api/health', async () => {
    app.db.prepare('SELECT 1').get();
    return { ok: true };
  });
}
