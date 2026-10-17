import type { drizzle } from "drizzle-orm/postgres-js";

import { inArray, notInArray } from "drizzle-orm";

import type { UpdateCheckError } from "@/database/updates";
import type { UpdateChannel, UpdateManifest } from "@/lib/updates/manifest";

import { core_update_results, core_update_sources } from "@/database/updates";
import { parseUpdateManifest } from "@/lib/updates/manifest";

import type { UpdateComponent } from "./components";
import type {
  FetchUpdateSourceOptions,
  UpdateSourceFetchResult,
} from "./fetch-source";

import { evaluateUpdate } from "./evaluate";
import { fetchUpdateSource, UpdateSourceError } from "./fetch-source";
import { startUpdateCheckHeartbeat } from "./heartbeat";
import {
  acquireUpdateCheckLease,
  releaseUpdateCheckLease,
  type UpdateCheckLease,
  UpdateCheckLeaseLostError,
  type UpdateCheckTx,
  withUpdateCheckLease,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const SOURCE_CONCURRENCY = 4;

const MAX_ERROR_DETAIL = 300;

export type FetchUpdateSource = (
  url: string,
  options: Pick<FetchUpdateSourceOptions, "signal" | "validators">,
) => Promise<UpdateSourceFetchResult>;

export interface UpdateCheckSummary {
  components: number;
  failedSources: number;
  securityUpdates: number;
  sources: number;
  updates: number;
}

type SourceOutcome =
  | { document: null | UpdateManifest; error: UpdateCheckError }
  | { document: UpdateManifest; error: null };

const errorOf = (error: unknown): UpdateCheckError => {
  if (error instanceof UpdateSourceError) {
    return { code: error.reason, detail: error.detail };
  }

  return { code: "network", detail: null };
};

/** Only the packages this install checks: the stored copy stays small. */
const pick = (
  manifest: UpdateManifest,
  ids: readonly string[],
): UpdateManifest => ({
  packages: Object.fromEntries(
    ids.flatMap(id => {
      const entry = manifest.packages[id];

      return entry === undefined ? [] : [[id, entry] as const];
    }),
  ),
  schemaVersion: manifest.schemaVersion,
});

/**
 * At most `limit` at a time. The caller's signal, or the first failure, stops
 * the rest: nothing new starts, running work sees its signal aborted, and every
 * worker has settled before this returns or throws.
 */
const mapLimited = async <T>(
  items: readonly T[],
  limit: number,
  signal: AbortSignal,
  run: (item: T, signal: AbortSignal) => Promise<void>,
): Promise<void> => {
  const failed = new AbortController();
  const scoped = AbortSignal.any([signal, failed.signal]);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      scoped.throwIfAborted();
      const item = items[next++];
      try {
        await run(item, scoped);
      } catch (error) {
        failed.abort(error);
        throw error;
      }
    }
  };

  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  signal.throwIfAborted();
  const failure = settled.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
};

/** Where a check runs and how it learns it lost the lease. */
export interface UpdateCheckLeaseScope {
  owner: string;
  /** Aborted with an `UpdateCheckLeaseLostError` once the lease can no longer be confirmed. */
  signal: AbortSignal;
}

/**
 * The one check behind the daily cron job and the AdminCP button. Fetches every
 * distinct update source once, validates it, evaluates each component against
 * it and stores the outcome. A source that fails keeps its last valid copy -
 * and every finding computed from it - and only records the failure, so one
 * unreachable publisher neither blocks the others nor turns into "up to date".
 *
 * Every write goes through the lease fence in its own short transaction - one
 * per source, holding the source and the results computed from it, then one for
 * the clean-up - and never spans a network request. Once the lease is lost the
 * check stops: requests in flight are aborted, queued ones never start, and
 * nothing more is stored. A cancelled request is not a publisher failure, so
 * the stored data stays exactly as the last committed write left it.
 */
export const checkForUpdates = async ({
  channelOverride,
  components,
  coreVersion,
  db,
  fetchSource = async (url, options) => await fetchUpdateSource(url, options),
  lease,
  now = new Date(),
}: {
  channelOverride: null | UpdateChannel;
  components: readonly UpdateComponent[];
  coreVersion: null | string;
  db: Db;
  fetchSource?: FetchUpdateSource;
  lease: UpdateCheckLeaseScope;
  now?: Date;
}): Promise<UpdateCheckSummary> => {
  const write = async (
    signal: AbortSignal,
    run: (tx: UpdateCheckTx) => Promise<void>,
  ) => {
    signal.throwIfAborted();
    await withUpdateCheckLease(db, lease.owner, run);
  };

  const checked = components.filter(
    (component): component is UpdateComponent & { sourceUrl: string } =>
      component.sourceUrl !== null,
  );
  const bySource = new Map<string, (typeof checked)[number][]>();
  for (const component of checked) {
    bySource.set(component.sourceUrl, [
      ...(bySource.get(component.sourceUrl) ?? []),
      component,
    ]);
  }
  const urls = [...bySource.keys()];

  lease.signal.throwIfAborted();
  const stored = new Map(
    urls.length === 0
      ? []
      : (
          await db
            .select()
            .from(core_update_sources)
            .where(inArray(core_update_sources.url, urls))
        ).map(row => [row.url, row]),
  );

  const summary: UpdateCheckSummary = {
    securityUpdates: 0,
    components: checked.length,
    failedSources: 0,
    sources: urls.length,
    updates: 0,
  };

  await mapLimited(
    urls,
    SOURCE_CONCURRENCY,
    lease.signal,
    async (url, signal) => {
      const previous = stored.get(url);
      const members = bySource.get(url) ?? [];
      const ids = members.map(component => component.id);
      // A 304 can only stand in for a copy that is stored and still covers every
      // package asked about now; otherwise ask for the full document.
      const reusable =
        previous?.document !== null &&
        previous?.document !== undefined &&
        ids.every(id => Object.hasOwn(previous.document?.packages ?? {}, id))
          ? previous.document
          : null;

      let outcome: SourceOutcome;
      let validators: null | {
        etag: null | string;
        lastModified: null | string;
      } = null;
      try {
        const response = await fetchSource(url, {
          signal,
          validators:
            reusable === null || (!previous?.etag && !previous?.lastModified)
              ? null
              : {
                  etag: previous?.etag ?? null,
                  lastModified: previous?.lastModified ?? null,
                },
        });

        if (response.kind === "not_modified") {
          outcome =
            reusable === null
              ? {
                  document: previous?.document ?? null,
                  error: { code: "http_error", detail: "unexpected 304" },
                }
              : { document: reusable, error: null };
          validators = {
            etag: previous?.etag ?? null,
            lastModified: previous?.lastModified ?? null,
          };
        } else {
          const parsed = parseUpdateManifest(response.body);
          if (parsed.ok) {
            outcome = {
              document: pick(parsed.manifest, ids),
              error: null,
            };
            validators = {
              etag: response.etag,
              lastModified: response.lastModified,
            };
          } else {
            outcome = {
              document: previous?.document ?? null,
              error: {
                code:
                  parsed.reason === "unsupported_schema"
                    ? "unsupported_schema"
                    : "invalid_manifest",
                detail: parsed.error.slice(0, MAX_ERROR_DETAIL),
              },
            };
          }
        }
      } catch (error) {
        // Cancelled, not failed: nothing about this source is recorded.
        signal.throwIfAborted();
        outcome = {
          document: previous?.document ?? null,
          error: errorOf(error),
        };
      }

      signal.throwIfAborted();
      const { document, error } = outcome;
      const evaluated =
        error === null
          ? members.map(component => ({
              component,
              result: evaluateUpdate({
                channelOverride,
                coreVersion,
                entry: document.packages[component.id],
                installed: component,
                isCore: component.kind === "core",
              }),
            }))
          : [];

      // The source and every result computed from it commit together, or not at all.
      await write(signal, async tx => {
        if (error === null) {
          const values = {
            document,
            etag: validators?.etag ?? null,
            lastAttemptAt: now,
            lastError: null,
            lastModified: validators?.lastModified ?? null,
            lastSuccessAt: now,
          };
          await tx
            .insert(core_update_sources)
            .values({ url, ...values })
            .onConflictDoUpdate({
              set: values,
              target: core_update_sources.url,
            });
        } else {
          await tx
            .insert(core_update_sources)
            .values({ lastAttemptAt: now, lastError: error, url })
            .onConflictDoUpdate({
              set: { lastAttemptAt: now, lastError: error },
              target: core_update_sources.url,
            });

          // The failure is recorded; what was found before - and the versions it
          // was found for - stays exactly as it was.
          for (const component of members) {
            await tx
              .insert(core_update_results)
              .values({
                channel: null,
                componentId: component.id,
                coreVersion,
                hasUnknownVersion: component.hasUnknownVersion,
                lastAttemptAt: now,
                lastError: error,
                result: null,
                sourceUrl: component.sourceUrl,
                versions: component.versions,
              })
              .onConflictDoUpdate({
                set: { lastAttemptAt: now, lastError: error },
                target: core_update_results.componentId,
              });
          }
        }

        for (const { component, result } of evaluated) {
          const values = {
            channel: result.channel,
            coreVersion,
            hasUnknownVersion: component.hasUnknownVersion,
            lastAttemptAt: now,
            lastError: null,
            lastSuccessAt: now,
            result,
            sourceUrl: component.sourceUrl,
            versions: component.versions,
          };
          await tx
            .insert(core_update_results)
            .values({ componentId: component.id, ...values })
            .onConflictDoUpdate({
              set: values,
              target: core_update_results.componentId,
            });
        }
      });

      // Counted only once stored, never for work this run could not commit.
      if (error !== null) summary.failedSources += 1;
      for (const { result } of evaluated) {
        summary.securityUpdates += result.securityUpdates.length;
        if (result.status === "update_available") summary.updates += 1;
      }
    },
  );

  // Removed plugins, and plugins that dropped their update source, leave no
  // result behind; neither does a source nothing points to any more.
  const checkedIds = checked.map(component => component.id);
  await write(lease.signal, async tx => {
    await tx
      .delete(core_update_results)
      .where(
        checkedIds.length === 0
          ? undefined
          : notInArray(core_update_results.componentId, checkedIds),
      );
    await tx
      .delete(core_update_sources)
      .where(
        urls.length === 0
          ? undefined
          : notInArray(core_update_sources.url, urls),
      );
  });

  return summary;
};

export type LockedUpdateCheck =
  | {
      reason: Extract<UpdateCheckLease, { acquired: false }>["reason"];
      retryAfterSeconds: number;
      status: "busy";
    }
  | { status: "completed"; summary: UpdateCheckSummary }
  /** The lease could not be confirmed mid-check, so the check stopped. What it committed before stays; nothing after. */
  | { status: "lease_lost" };

/**
 * The whole lease lifecycle, the same for the cron job and the button: take
 * the lease, keep renewing it, check, stop the heartbeat and wait for it, then
 * give the lease back - which only happens while it is still this run's.
 */
export const runLockedUpdateCheck = async ({
  manual,
  ...options
}: Omit<Parameters<typeof checkForUpdates>[0], "lease"> & {
  manual: boolean;
}): Promise<LockedUpdateCheck> => {
  const confirmedAt = Date.now();
  const lease = await acquireUpdateCheckLease(options.db, { manual });
  if (!lease.acquired) {
    return {
      reason: lease.reason,
      retryAfterSeconds: lease.retryAfterSeconds,
      status: "busy",
    };
  }

  const heartbeat = startUpdateCheckHeartbeat({
    confirmedAt,
    db: options.db,
    owner: lease.owner,
  });
  try {
    return {
      status: "completed",
      summary: await checkForUpdates({
        ...options,
        lease: { owner: lease.owner, signal: heartbeat.signal },
      }),
    };
  } catch (error) {
    if (error instanceof UpdateCheckLeaseLostError) {
      return { status: "lease_lost" };
    }
    throw error;
  } finally {
    await heartbeat.stop();
    // A failure here must not hide the check's own outcome; an unreleased lease
    // simply runs out within UPDATE_CHECK_LEASE_MS.
    await releaseUpdateCheckLease(options.db, lease.owner).catch(() => false);
  }
};
