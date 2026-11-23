import type { DB, ClassRow } from './db';
import type { Storage } from './storage';

export async function purgeExpired(db: DB, storage: Storage, now: Date, days: number): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const expired = db.prepare('SELECT id FROM classes WHERE last_activity_at <= ?').all(cutoff) as Pick<ClassRow, 'id'>[];
  const del = db.prepare('DELETE FROM classes WHERE id = ?');
  db.transaction(() => expired.forEach((r) => del.run(r.id)))();
  const live = new Set((db.prepare('SELECT id FROM classes').all() as Pick<ClassRow, 'id'>[]).map((r) => r.id));
  for (const dir of await storage.listClassDirs()) if (!live.has(dir)) await storage.removeClass(dir);
  return expired.length;
}
