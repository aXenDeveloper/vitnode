const store = globalThis as typeof globalThis & {
  __vitnodeProcessSingletons?: Map<string, unknown>;
};

/**
 * Creates a value once per process and returns the same one afterwards, even
 * when the module that asks is evaluated again - which is what Vite does to
 * server modules on every hot update. Use it for boot-time resources that must
 * not exist twice: a Redis connection, a cron scheduler. Server-only.
 */
export const processSingleton = <T>(key: string, create: () => T): T => {
  store.__vitnodeProcessSingletons ??= new Map();
  const singletons = store.__vitnodeProcessSingletons;

  if (!singletons.has(key)) singletons.set(key, create());

  return singletons.get(key) as T;
};
