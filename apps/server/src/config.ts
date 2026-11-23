export interface Config {
  publicUrl: string;
  port: number;
  dataDir: string;
  retentionDays: number;
  maxModelsPerClass: number;
  trustProxy: string | boolean;
  webDist: string | null;
}

function int(v: string | undefined, d: number): number {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const tp = env.TRUST_PROXY ?? 'loopback';
  return {
    publicUrl: (env.PUBLIC_URL ?? 'https://toyforge.chupa.nexus').replace(/\/+$/, ''),
    port: int(env.PORT, 3000),
    dataDir: env.DATA_DIR ?? '/data',
    retentionDays: int(env.RETENTION_DAYS, 30),
    maxModelsPerClass: int(env.MAX_MODELS_PER_CLASS, 500),
    trustProxy: tp === 'true' ? true : tp === 'false' ? false : tp,
    webDist: env.WEB_DIST || null,
  };
}
