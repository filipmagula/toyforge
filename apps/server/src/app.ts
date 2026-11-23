import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { openDb, type ClassRow, type DB } from './db';
import { Storage } from './storage';
import type { Config } from './config';
import { HttpError } from './errors';
import { classRoutes } from './routes/classes';
import { teacherRoutes } from './routes/teacher';
import { submissionRoutes } from './routes/submissions';

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
    storage: Storage;
    config: Config;
    now: () => Date;
  }
  interface FastifyRequest {
    teacherClass?: ClassRow;
  }
}

export async function buildApp(config: Config, opts: { now?: () => Date; logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger
      ? { redact: ['req.headers.authorization'], serializers: { req: (r) => ({ method: r.method, url: r.url.replace(/token=[^&]+/, 'token=***') }) } }
      : false,
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
  });
  const db = openDb(config.dataDir);
  app.decorate('db', db);
  app.decorate('storage', new Storage(config.dataDir));
  app.decorate('config', config);
  app.decorate('now', opts.now ?? (() => new Date()));
  app.addHook('onClose', async () => db.close());

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment.'),
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    const status = err.statusCode ?? 500;
    if (status === 413 || err.code === 'FST_REQ_FILE_TOO_LARGE' || err.code === 'FST_FILES_LIMIT') {
      return reply.code(413).send({ error: 'too_large', message: 'Upload too large.' });
    }
    if (status >= 400 && status < 500) return reply.code(status).send({ error: 'validation', message: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong.' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found', message: 'Not found.' }));

  await app.register(classRoutes);
  await app.register(submissionRoutes);
  await app.register(teacherRoutes);
  return app;
}
