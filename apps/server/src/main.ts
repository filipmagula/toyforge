import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config';
import { purgeExpired } from './retention';
import { registerStatic } from './static';

const config = loadConfig(process.env);
const app = await buildApp(config, { logger: true });
if (config.webDist) await registerStatic(app, resolve(config.webDist));

async function housekeeping() {
  try {
    const n = await purgeExpired(app.db, app.storage, new Date(), config.retentionDays);
    if (n) app.log.info({ deleted: n }, 'purged expired classes');
    const fs = await statfs(config.dataDir);
    const free = fs.bavail * fs.bsize;
    if (free < 1024 ** 3) app.log.warn({ freeBytes: free }, 'low disk space');
  } catch (e) {
    app.log.error(e, 'housekeeping failed');
  }
}
await housekeeping();
const timer = setInterval(housekeeping, 60 * 60 * 1000);

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    clearInterval(timer);
    await app.close();
    process.exit(0);
  });
}

await app.listen({ host: '0.0.0.0', port: config.port });
