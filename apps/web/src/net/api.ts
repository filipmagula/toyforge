import type { ClassInfo, ErrorCode, SubmitResponse } from '@toyforge/shared';
import type { Submission } from './queue';

export type SendResult =
  | { kind: 'sent'; response: SubmitResponse }
  | { kind: 'retry' }
  | { kind: 'rejected'; error: ErrorCode };

async function errorCode(res: Response): Promise<ErrorCode> {
  try {
    const body = (await res.json()) as { error?: ErrorCode };
    return body.error ?? 'validation';
  } catch {
    return res.status === 404 ? 'not_found' : 'validation';
  }
}

/** Uploads are small (<1 MB); 30 s covers slow school Wi-Fi without leaving a kid waiting on a dead connection. */
export const UPLOAD_TIMEOUT_MS = 30_000;

export async function sendSubmission(s: Submission, fetchImpl: typeof fetch = fetch, opts: { timeoutMs?: number } = {}): Promise<SendResult> {
  const fd = new FormData();
  fd.set('submissionId', s.submissionId);
  fd.set('makerName', s.makerName);
  fd.set('characterName', s.characterName);
  fd.set('recipeJson', JSON.stringify(s.recipe));
  fd.set('stlFile', new Blob([s.stl], { type: 'model/stl' }), 'model.stl');
  fd.set('thumbnail', new Blob([s.thumbnail], { type: 'image/png' }), 'thumbnail.png');
  let res: Response;
  try {
    res = await fetchImpl(`/api/classes/${encodeURIComponent(s.code)}/models`, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(opts.timeoutMs ?? UPLOAD_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'retry' };
  }
  if (res.status === 200 || res.status === 201) return { kind: 'sent', response: (await res.json()) as SubmitResponse };
  if (res.status === 429 || res.status >= 500) return { kind: 'retry' };
  return { kind: 'rejected', error: await errorCode(res) };
}

export type LookupResult = { kind: 'ok'; info: ClassInfo } | { kind: 'error'; error: ErrorCode | 'network' };

export async function lookupClass(code: string, fetchImpl: typeof fetch = fetch): Promise<LookupResult> {
  try {
    const res = await fetchImpl(`/api/classes/${encodeURIComponent(code)}`);
    if (res.ok) return { kind: 'ok', info: (await res.json()) as ClassInfo };
    return { kind: 'error', error: await errorCode(res) };
  } catch {
    return { kind: 'error', error: 'network' };
  }
}
