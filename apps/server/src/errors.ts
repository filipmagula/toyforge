import type { FastifyReply } from 'fastify';
import type { ErrorCode } from '@toyforge/shared';

export class HttpError extends Error {
  constructor(public statusCode: number, public code: ErrorCode, message: string) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, status: number, error: ErrorCode, message: string) {
  return reply.code(status).send({ error, message });
}

/** Simple fixed-window counter used for limits that @fastify/rate-limit can't key (per class, failed auth). */
export class WindowCounter {
  private hits = new Map<string, { start: number; count: number }>();
  constructor(private windowMs: number, private max: number) {}
  /** Returns true when the hit is allowed. */
  hit(key: string, now: number): boolean {
    const e = this.hits.get(key);
    if (!e || now - e.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    e.count++;
    return e.count <= this.max;
  }
  blocked(key: string, now: number): boolean {
    const e = this.hits.get(key);
    return !!e && now - e.start < this.windowMs && e.count >= this.max;
  }
  private prune(now: number) {
    for (const [k, e] of this.hits) if (now - e.start >= this.windowMs) this.hits.delete(k);
  }
}
