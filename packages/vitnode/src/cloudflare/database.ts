import {
  currentRealtimeScope,
  isWorkerdRuntime,
  RealtimeConfigurationError,
  realtimeScopeRequirement,
} from "@/ws/runtime";

/**
 * A database client (or any I/O-bound object) whose real instance belongs to
 * the scope that uses it. Use it for `dbProvider` in an app deployed to
 * Cloudflare Workers, where a TCP connection opened by one request cannot be
 * used by another:
 *
 * - in a Worker request (or `runWithVitNodeCloudflare`), `create` runs once per
 *   invocation;
 * - in the realtime hub, once per busy period: the hub keeps its client
 *   across socket events and closes it (`dispose`) when it goes idle, so an
 *   open connection never keeps it from hibernating;
 * - on Node/Bun, outside any scope, once per process, exactly like a client
 *   created at module load.
 *
 * Returns a stand-in with the client's own type: every property access is
 * forwarded to the instance of the current scope, so code that captured it
 * (the API config, a handshake's Hono context) always reaches a client that is
 * valid where it runs. Universal, server-only.
 *
 * @throws {RealtimeConfigurationError} When used on Cloudflare outside a
 * scope.
 *
 * @example
 * ```ts
 * import { scopedDatabase } from "@vitnode/core/cloudflare/database";
 * import { coreRelations } from "@vitnode/core/database/relations";
 * import { drizzle } from "drizzle-orm/postgres-js";
 *
 * dbProvider: scopedDatabase(() =>
 *   drizzle({
 *     connection: { url: process.env.POSTGRES_URL, max: 1 },
 *     relations: coreRelations,
 *   }),
 * ),
 * ```
 */
/**
 * Closes a Drizzle client's driver at once: `end({ timeout: 0 })` drops
 * postgres.js connections without waiting, which also ends their pending
 * socket reads. A client without `$client.end` is left alone.
 */
const closeDriverClient = async (instance: object): Promise<void> => {
  const client: unknown = Reflect.get(instance, "$client");
  if (typeof client !== "object" && typeof client !== "function") return;
  if (client === null) return;
  const end: unknown = Reflect.get(client, "end");
  if (typeof end === "function") {
    await (end as (options: { timeout: number }) => Promise<void>).call(
      client,
      { timeout: 0 },
    );
  }
};

export const scopedDatabase = <T extends object>(
  create: () => T,
  {
    dispose = closeDriverClient,
  }: {
    /**
     * Closes an instance when its owner goes idle - a realtime hub ~2 s after
     * its last event, so an open connection does not keep it from
     * hibernating. Defaults to `$client.end({ timeout: 0 })`, which closes a
     * Drizzle client on postgres.js or node-postgres.
     */
    dispose?: (instance: T) => Promise<void> | void;
  } = {},
): T => {
  const key = Symbol("vitnode.scoped-database");
  let processInstance: T | undefined;

  const resolve = (): T => {
    const resources = currentRealtimeScope()?.resources;
    if (resources) {
      const existing = resources.get(key);
      if (existing) return existing.instance as T;
      const instance = create();
      resources.set(key, {
        dispose: async () => {
          await dispose(instance);
        },
        instance,
      });

      return instance;
    }

    const requirement = realtimeScopeRequirement();
    if (requirement || isWorkerdRuntime()) {
      throw new RealtimeConfigurationError(
        `[VitNode] The database was used outside a VitNode execution scope on Cloudflare Workers. ${requirement?.hint ?? "Use it inside a request, a socket event or runWithVitNodeCloudflare(...)."}`,
      );
    }

    return (processInstance ??= create());
  };

  return new Proxy({} as T, {
    get: (_target, property) => {
      const instance = resolve();
      const value: unknown = Reflect.get(instance, property, instance);

      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve()),
    has: (_target, property) => Reflect.has(resolve(), property),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_target, property) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), property);

      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
};
