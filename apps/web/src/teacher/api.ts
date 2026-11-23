import type { CreateClassResponse, ErrorCode, ModelSummary, PrintStatus, TeacherClass } from '@toyforge/shared';

export class ApiFailure extends Error {
  constructor(public status: number, public code: ErrorCode | 'network') { super(code); }
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  let code: ErrorCode = 'internal';
  try { code = ((await res.json()) as { error: ErrorCode }).error ?? code; } catch { /* not json */ }
  throw new ApiFailure(res.status, code);
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try { res = await fetch(path, init); } catch { throw new ApiFailure(0, 'network'); }
  return check(res);
}

export async function createClass(name: string): Promise<CreateClassResponse> {
  const res = await call('/api/classes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  return res.json();
}

export function teacherApi(key: string) {
  const auth = { authorization: `Bearer ${key}` };
  const json = (method: string, body: unknown) => ({ method, headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const thumbs = new Map<string, Promise<string>>();
  return {
    getClass: async (): Promise<TeacherClass> => (await call('/api/teacher/class', { headers: auth })).json(),
    patchClass: async (p: { name?: string; isOpen?: boolean }): Promise<TeacherClass> => (await call('/api/teacher/class', json('PATCH', p))).json(),
    deleteClass: async () => { await call('/api/teacher/class', { method: 'DELETE', headers: auth }); },
    listModels: async (status: PrintStatus | 'all'): Promise<ModelSummary[]> => (await call(`/api/teacher/models?status=${status}`, { headers: auth })).json(),
    thumbnailUrl(id: string): Promise<string> {
      if (!thumbs.has(id)) {
        const p = call(`/api/teacher/models/${id}/thumbnail`, { headers: auth }).then(async (r) => URL.createObjectURL(await r.blob()));
        p.catch(() => thumbs.delete(id));
        thumbs.set(id, p);
      }
      return thumbs.get(id)!;
    },
    async downloadStl(id: string): Promise<{ blob: Blob; filename: string }> {
      const res = await call(`/api/teacher/models/${id}/stl`, { headers: auth });
      const cd = res.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? `${id}.stl`;
      return { blob: await res.blob(), filename };
    },
    setStatus: async (id: string, printStatus: PrintStatus): Promise<ModelSummary> => (await call(`/api/teacher/models/${id}`, json('PATCH', { printStatus }))).json(),
    deleteModel: async (id: string) => { await call(`/api/teacher/models/${id}`, { method: 'DELETE', headers: auth }); },
    async zipUrl(status: 'new' | 'all', markAsQueued: boolean): Promise<string> {
      const res = await call('/api/teacher/download-token', json('POST', { status, markAsQueued }));
      return ((await res.json()) as { url: string }).url;
    },
  };
}

export type TeacherApi = ReturnType<typeof teacherApi>;
