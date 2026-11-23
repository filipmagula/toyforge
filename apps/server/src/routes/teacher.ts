import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ZipArchive } from 'archiver';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PRINT_STATUSES, stlArchiveName, validateName, type ModelSummary, type PrintStatus, type TeacherClass } from '@toyforge/shared';
import { hashKey, requireTeacher } from '../auth';
import { expiresAt, touchClass, type ClassRow, type ModelRow } from '../db';
import { sendError } from '../errors';

export function teacherClassView(app: FastifyInstance, row: ClassRow): TeacherClass {
  const counts = { total: 0, new: 0, queued: 0, printed: 0 };
  const rows = app.db.prepare('SELECT print_status s, COUNT(*) n FROM models WHERE class_id = ? GROUP BY print_status').all(row.id) as { s: PrintStatus; n: number }[];
  for (const r of rows) { counts[r.s] = r.n; counts.total += r.n; }
  return {
    code: row.code,
    name: row.name,
    isOpen: !!row.is_open,
    createdAt: row.created_at,
    expiresAt: expiresAt(row, app.config.retentionDays),
    counts,
  };
}

function modelView(row: ModelRow): ModelSummary {
  return {
    id: row.id,
    makerName: row.maker_name,
    characterName: row.character_name,
    printStatus: row.print_status,
    stlSizeBytes: row.stl_size_bytes,
    triangleCount: row.triangle_count,
    createdAt: row.created_at,
    recipe: JSON.parse(row.recipe_json),
  };
}

function csv(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function attachment(filename: string): string {
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

interface ZipToken { classId: string; status: 'new' | 'all'; markAsQueued: boolean; expires: number }

export async function teacherRoutes(app: FastifyInstance) {
  const tokens = new Map<string, ZipToken>();
  const keyLimit = {
    rateLimit: { max: 300, timeWindow: '1 minute', keyGenerator: (req: FastifyRequest) => hashKey(req.headers.authorization ?? req.ip) },
  };
  const guarded = { preHandler: requireTeacher, config: keyLimit };

  const findModel = (req: FastifyRequest<{ Params: { id: string } }>) =>
    app.db.prepare('SELECT * FROM models WHERE id = ? AND class_id = ?').get(req.params.id, req.teacherClass!.id) as ModelRow | undefined;
  const notFound = (reply: FastifyReply) => sendError(reply, 404, 'not_found', 'Model not found.');
  const touch = (req: FastifyRequest) => touchClass(app.db, req.teacherClass!.id, app.now());

  app.get('/api/teacher/class', guarded, async (req) => teacherClassView(app, req.teacherClass!));

  app.patch<{ Body: { name?: unknown; isOpen?: unknown } }>('/api/teacher/class', guarded, async (req, reply) => {
    const body = req.body ?? {};
    const cls = req.teacherClass!;
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? validateName('className', body.name) : null;
      if (!name || !name.ok) return sendError(reply, 400, 'validation', 'Invalid class name.');
      app.db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(name.value, cls.id);
    }
    if (body.isOpen !== undefined) {
      if (typeof body.isOpen !== 'boolean') return sendError(reply, 400, 'validation', 'isOpen must be boolean.');
      app.db.prepare('UPDATE classes SET is_open = ? WHERE id = ?').run(body.isOpen ? 1 : 0, cls.id);
    }
    touch(req);
    return teacherClassView(app, app.db.prepare('SELECT * FROM classes WHERE id = ?').get(cls.id) as ClassRow);
  });

  app.delete('/api/teacher/class', guarded, async (req, reply) => {
    const cls = req.teacherClass!;
    app.db.prepare('DELETE FROM classes WHERE id = ?').run(cls.id);
    await app.storage.removeClass(cls.id);
    return reply.code(204).send();
  });

  app.get<{ Querystring: { status?: string } }>('/api/teacher/models', guarded, async (req, reply) => {
    const status = req.query.status ?? 'all';
    if (status !== 'all' && !PRINT_STATUSES.includes(status as PrintStatus)) return sendError(reply, 400, 'validation', 'Invalid status.');
    const rows = (status === 'all'
      ? app.db.prepare('SELECT * FROM models WHERE class_id = ? ORDER BY created_at DESC, rowid DESC').all(req.teacherClass!.id)
      : app.db.prepare('SELECT * FROM models WHERE class_id = ? AND print_status = ? ORDER BY created_at DESC, rowid DESC').all(req.teacherClass!.id, status)) as ModelRow[];
    return rows.map(modelView);
  });

  app.get<{ Params: { id: string } }>('/api/teacher/models/:id/thumbnail', guarded, async (req, reply) => {
    const m = findModel(req);
    if (!m) return notFound(reply);
    return reply.type('image/png').header('cache-control', 'private, max-age=86400').send(createReadStream(app.storage.modelPaths(m.class_id, m.id).png));
  });

  app.get<{ Params: { id: string } }>('/api/teacher/models/:id/stl', guarded, async (req, reply) => {
    const m = findModel(req);
    if (!m) return notFound(reply);
    return reply
      .type('model/stl')
      .header('content-disposition', attachment(stlArchiveName(m.maker_name, m.character_name, m.id)))
      .send(createReadStream(app.storage.modelPaths(m.class_id, m.id).stl));
  });

  app.patch<{ Params: { id: string }; Body: { printStatus?: unknown } }>('/api/teacher/models/:id', guarded, async (req, reply) => {
    const m = findModel(req);
    if (!m) return notFound(reply);
    const s = req.body?.printStatus;
    if (typeof s !== 'string' || !PRINT_STATUSES.includes(s as PrintStatus)) return sendError(reply, 400, 'validation', 'Invalid printStatus.');
    app.db.prepare('UPDATE models SET print_status = ? WHERE id = ?').run(s, m.id);
    touch(req);
    return modelView({ ...m, print_status: s as PrintStatus });
  });

  app.delete<{ Params: { id: string } }>('/api/teacher/models/:id', guarded, async (req, reply) => {
    const m = findModel(req);
    if (!m) return notFound(reply);
    app.db.prepare('DELETE FROM models WHERE id = ?').run(m.id);
    await app.storage.removeModel(m.class_id, m.id);
    touch(req);
    return reply.code(204).send();
  });

  app.post<{ Body: { status?: unknown; markAsQueued?: unknown } }>('/api/teacher/download-token', guarded, async (req, reply) => {
    const status = req.body?.status === 'new' ? 'new' : req.body?.status === 'all' ? 'all' : null;
    if (!status) return sendError(reply, 400, 'validation', 'status must be new or all.');
    const now = app.now().getTime();
    for (const [k, t] of tokens) if (t.expires <= now) tokens.delete(k);
    const token = randomBytes(24).toString('base64url');
    tokens.set(token, { classId: req.teacherClass!.id, status, markAsQueued: req.body?.markAsQueued === true, expires: now + 60_000 });
    return { url: `/api/teacher/models.zip?token=${token}` };
  });

  app.get<{ Querystring: { token?: string } }>('/api/teacher/models.zip', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const t = req.query.token ? tokens.get(req.query.token) : undefined;
    const now = app.now();
    if (!t || t.expires <= now.getTime()) return sendError(reply, 404, 'not_found', 'Download link expired.');
    tokens.delete(req.query.token!);
    const cls = app.db.prepare('SELECT * FROM classes WHERE id = ?').get(t.classId) as ClassRow | undefined;
    if (!cls) return sendError(reply, 404, 'not_found', 'Class not found.');
    const rows = (t.status === 'all'
      ? app.db.prepare('SELECT * FROM models WHERE class_id = ? ORDER BY created_at, rowid').all(cls.id)
      : app.db.prepare("SELECT * FROM models WHERE class_id = ? AND print_status = 'new' ORDER BY created_at, rowid").all(cls.id)) as ModelRow[];
    if (t.markAsQueued && t.status === 'new' && rows.length) {
      const upd = app.db.prepare("UPDATE models SET print_status = 'queued' WHERE id = ? AND print_status = 'new'");
      app.db.transaction(() => rows.forEach((r) => upd.run(r.id)))();
      rows.forEach((r) => { r.print_status = 'queued'; });
    }
    touchClass(app.db, cls.id, now);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const lines = ['maker_name,character_name,created_at,status,filename'];
    for (const r of rows) {
      const name = stlArchiveName(r.maker_name, r.character_name, r.id);
      archive.file(app.storage.modelPaths(cls.id, r.id).stl, { name });
      lines.push([r.maker_name, r.character_name, r.created_at, r.print_status, name].map(csv).join(','));
    }
    archive.append('﻿' + lines.join('\r\n') + '\r\n', { name: 'manifest.csv' });
    void archive.finalize();
    const date = now.toISOString().slice(0, 10);
    reply.type('application/zip').header('content-disposition', attachment(`toyforge_${cls.code}_${date}.zip`));
    return reply.send(archive);
  });
}
