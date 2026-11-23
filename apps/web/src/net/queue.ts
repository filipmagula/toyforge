import { openDB, type IDBPDatabase } from 'idb';
import type { ErrorCode, Recipe } from '@toyforge/shared';

export interface Submission {
  submissionId: string;
  code: string;
  makerName: string;
  characterName: string;
  recipe: Recipe;
  /** Stored as ArrayBuffer: Blobs in IndexedDB are unreliable on older iOS Safari. */
  stl: ArrayBuffer;
  thumbnail: ArrayBuffer;
  createdAt: string;
  rejected?: ErrorCode;
}

export interface Queue {
  put(s: Submission): Promise<void>;
  all(): Promise<Submission[]>;
  remove(id: string): Promise<void>;
  markRejected(id: string, error: ErrorCode): Promise<void>;
}

const STORE = 'submissions';

export async function openQueue(dbName = 'toyforge'): Promise<Queue> {
  const db: IDBPDatabase = await openDB(dbName, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: 'submissionId' });
    },
  });
  return {
    async put(s) { await db.put(STORE, s); },
    async all() {
      const items = (await db.getAll(STORE)) as Submission[];
      return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async remove(id) { await db.delete(STORE, id); },
    async markRejected(id, error) {
      const s = (await db.get(STORE, id)) as Submission | undefined;
      if (s) await db.put(STORE, { ...s, rejected: error });
    },
  };
}

/** In-memory fallback when IndexedDB is unavailable (e.g. private mode on some browsers). */
export function memoryQueue(): Queue {
  const m = new Map<string, Submission>();
  return {
    async put(s) { m.set(s.submissionId, s); },
    async all() { return [...m.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); },
    async remove(id) { m.delete(id); },
    async markRejected(id, error) { const s = m.get(id); if (s) m.set(id, { ...s, rejected: error }); },
  };
}
