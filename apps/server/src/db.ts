import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type DB = Database.Database;

export interface ClassRow {
  id: string;
  code: string;
  name: string;
  teacher_key_hash: string;
  is_open: number;
  created_at: string;
  last_activity_at: string;
}

export interface ModelRow {
  id: string;
  class_id: string;
  maker_name: string;
  character_name: string;
  stl_size_bytes: number;
  triangle_count: number;
  recipe_json: string;
  print_status: 'new' | 'queued' | 'printed';
  created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS classes (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL DEFAULT '',
  teacher_key_hash  TEXT NOT NULL UNIQUE,
  is_open           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  last_activity_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS models (
  id                TEXT PRIMARY KEY,
  class_id          TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  maker_name        TEXT NOT NULL,
  character_name    TEXT NOT NULL,
  stl_size_bytes    INTEGER NOT NULL,
  triangle_count    INTEGER NOT NULL,
  recipe_json       TEXT NOT NULL,
  print_status      TEXT NOT NULL DEFAULT 'new' CHECK (print_status IN ('new','queued','printed')),
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS models_class ON models(class_id, created_at);
`;

export function openDb(dataDir: string): DB {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'toyforge.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

const DAY = 86_400_000;

export function expiresAt(row: Pick<ClassRow, 'last_activity_at'>, days: number): string {
  return new Date(Date.parse(row.last_activity_at) + days * DAY).toISOString();
}

export function isExpired(row: Pick<ClassRow, 'last_activity_at'>, now: Date, days: number): boolean {
  return Date.parse(row.last_activity_at) + days * DAY <= now.getTime();
}

export function touchClass(db: DB, classId: string, now: Date): void {
  db.prepare('UPDATE classes SET last_activity_at = ? WHERE id = ?').run(now.toISOString(), classId);
}
