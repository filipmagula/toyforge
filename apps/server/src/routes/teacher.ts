import type { FastifyInstance } from 'fastify';
import type { TeacherClass } from '@toyforge/shared';
import { requireTeacher } from '../auth';
import { expiresAt, type ClassRow } from '../db';

export function teacherClassView(app: FastifyInstance, row: ClassRow): TeacherClass {
  const counts = { total: 0, new: 0, queued: 0, printed: 0 };
  const rows = app.db.prepare('SELECT print_status s, COUNT(*) n FROM models WHERE class_id = ? GROUP BY print_status').all(row.id) as { s: keyof typeof counts; n: number }[];
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

export async function teacherRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireTeacher);
  app.get('/api/teacher/class', async (req) => teacherClassView(app, req.teacherClass!));
}
