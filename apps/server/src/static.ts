import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

export async function registerStatic(app: FastifyInstance, webDist: string) {
  await app.register(fastifyStatic, {
    root: webDist,
    index: ['index.html'],
    wildcard: true,
    setHeaders(res: { header(k: string, v: string): unknown }, path: string) {
      res.header('cache-control', /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  for (const page of ['teacher', 'privacy']) {
    app.get(`/${page}`, (_req, reply) => reply.sendFile(`${page}.html`));
    app.get(`/${page}/`, (_req, reply) => reply.sendFile(`${page}.html`));
  }
}
