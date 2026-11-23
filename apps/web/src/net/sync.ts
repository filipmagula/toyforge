import { sendSubmission, type SendResult } from './api';
import type { Queue, Submission } from './queue';

export type SubmitOutcome = SendResult | { kind: 'queued' };

export interface Sync {
  submitOrQueue(s: Submission): Promise<SubmitOutcome>;
  flush(): Promise<void>;
  pendingCount(): Promise<number>;
  onChange(fn: () => void): () => void;
  start(): void;
}

const DEFAULT_BACKOFF = [5_000, 15_000, 60_000, 300_000];

export function createSync(queue: Queue, send: (s: Submission) => Promise<SendResult> = sendSubmission, opts: { backoffMs?: number[] } = {}): Sync {
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF;
  const listeners = new Set<() => void>();
  const inflight = new Set<string>();
  let flushing: Promise<void> | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;

  const changed = () => listeners.forEach((fn) => fn());

  async function pendingCount() {
    return (await queue.all()).filter((s) => !s.rejected).length;
  }

  function schedule() {
    if (!started) return;
    clearTimeout(timer);
    void pendingCount().then((n) => {
      if (!n) { attempt = 0; return; }
      const delay = backoff[Math.min(attempt, backoff.length - 1)]!;
      attempt++;
      timer = setTimeout(() => void flush(), delay);
    });
  }

  async function doFlush() {
    for (const s of await queue.all()) {
      if (s.rejected || inflight.has(s.submissionId)) continue;
      inflight.add(s.submissionId);
      try {
        const r = await send(s);
        if (r.kind === 'sent') { await queue.remove(s.submissionId); attempt = 0; changed(); }
        else if (r.kind === 'rejected') { await queue.markRejected(s.submissionId, r.error); changed(); }
        else break; // still offline: stop and wait for the next attempt
      } finally {
        inflight.delete(s.submissionId);
      }
    }
  }

  async function flush() {
    if (!flushing) flushing = doFlush().finally(() => { flushing = null; schedule(); });
    return flushing;
  }

  return {
    async submitOrQueue(s) {
      await queue.put(s);
      changed();
      inflight.add(s.submissionId);
      let r: SendResult;
      try {
        r = await send(s);
      } finally {
        inflight.delete(s.submissionId);
      }
      if (r.kind === 'retry') { schedule(); return { kind: 'queued' }; }
      await queue.remove(s.submissionId);
      changed();
      return r;
    },
    flush,
    pendingCount,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() {
      if (started) return;
      started = true;
      window.addEventListener('online', () => { attempt = 0; void flush(); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void flush(); });
      void flush();
    },
  };
}
