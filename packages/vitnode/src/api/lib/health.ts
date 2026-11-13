import type { Hono } from "hono";

import { sql } from "drizzle-orm";

import type { VitNodeApiConfig } from "@/vitnode.config";

import type { CacheClient } from "./cache";

/** Where the probes live, under the API's base path: `/api/health`. */
const HEALTH_PATH = "/health";

/** How long one dependency may take before it counts as down. */
const CHECK_TIMEOUT_MS = 2000;

/**
 * How long a readiness answer is reused. Probes are unauthenticated and skip
 * the rate limiter, so a flood of them must not become a flood of queries:
 * concurrent and back-to-back probes share one check.
 */
const READY_CACHE_MS = 1000;

/**
 * `ok` - everything answered. `degraded` - Redis is configured but did not
 * answer; VitNode keeps serving (the cache falls back to memory) but instances
 * no longer share cache, rate limits or realtime. `unavailable` - the database
 * did not answer, so nothing that needs it works.
 */
export type HealthStatus = "degraded" | "ok" | "unavailable";

const withTimeout = async (task: Promise<unknown>): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => {
    timer = setTimeout(() => {
      resolve(false);
    }, CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([task.then(() => true), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const logTransition = (from: HealthStatus, to: HealthStatus): void => {
  // oxlint-disable-next-line no-console
  const log = to === "ok" ? console.info : console.error;
  log(
    `\x1b[34m[VitNode]\x1b[0m Health changed from "${from}" to "${to}"${
      to === "unavailable"
        ? ": the database did not answer"
        : to === "degraded"
          ? ": Redis did not answer"
          : ""
    }.`,
  );
};

/**
 * Builds the readiness check: the database must answer `select 1`, and a
 * configured Redis must answer `PING`, each within 2 s. Results are shared for
 * a second, and every change of status is logged once, so an operator learns
 * which dependency failed without the public response saying so.
 */
export const createReadinessCheck = ({
  cacheClient,
  db,
}: {
  cacheClient: CacheClient | null;
  db: Pick<VitNodeApiConfig["dbProvider"], "execute">;
}): (() => Promise<HealthStatus>) => {
  let last: HealthStatus = "ok";
  let cached: undefined | { at: number; status: Promise<HealthStatus> };

  const check = async (): Promise<HealthStatus> => {
    const [database, redis] = await Promise.all([
      withTimeout(db.execute(sql`select 1`)),
      cacheClient ? withTimeout(cacheClient.ping()) : true,
    ]);
    const status: HealthStatus = !database
      ? "unavailable"
      : redis
        ? "ok"
        : "degraded";
    if (status !== last) {
      logTransition(last, status);
      last = status;
    }

    return status;
  };

  return async () => {
    if (!cached || Date.now() - cached.at >= READY_CACHE_MS) {
      cached = { at: Date.now(), status: check() };
    }

    return await cached.status;
  };
};

/**
 * Mounts the health probes on the API, before rate limiting and the
 * per-request context, so they stay cheap and work for anonymous callers:
 *
 * - `GET /api/health` - liveness. `200 {"status":"ok"}` whenever the process
 *   answers HTTP; it touches nothing else. Restart the process when it fails.
 * - `GET /api/health/ready` - readiness. `200` with `ok` or `degraded`, `503`
 *   with `unavailable` when the database does not answer. Stop routing
 *   traffic to the instance while it fails.
 *
 * Responses carry the status only - never versions, hosts or error text - and
 * are never cached. Called by `VitNodeAPI`.
 */
export const mountHealthRoutes = (
  app: Pick<Hono, "get">,
  check: () => Promise<HealthStatus>,
): void => {
  const noStore = { "Cache-Control": "no-store" };

  app.get(HEALTH_PATH, c => c.json({ status: "ok" }, 200, noStore));
  app.get(`${HEALTH_PATH}/ready`, async c => {
    const status = await check();

    return c.json({ status }, status === "unavailable" ? 503 : 200, noStore);
  });
};
