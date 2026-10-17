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
import {
  acquireUpdateCheckLease,
  releaseUpdateCheckLease,
  type UpdateCheckLease,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const SOURCE_CONCURRENCY = 4;

const MAX_ERROR_DETAIL = 300;

export type FetchUpdateSource = (
  url: string,
  options: Pick<FetchUpdateSourceOptions, "validators">,
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

const mapLimited = async <T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );

  return results;
};

/**
 * The one check behind the daily cron job and the AdminCP button. Fetches every
 * distinct update source once, validates it, evaluates each component against
 * it and stores the outcome. A source that fails keeps its last valid copy -
 * and every finding computed from it - and only records the failure, so one
 * unreachable publisher neither blocks the others nor turns into "up to date".
 */
export const checkForUpdates = async ({
  channelOverride,
  components,
  coreVersion,
  db,
  fetchSource = async (url, options) => await fetchUpdateSource(url, options),
  now = new Date(),
}: {
  channelOverride: null | UpdateChannel;
  components: readonly UpdateComponent[];
  coreVersion: null | string;
  db: Db;
  fetchSource?: FetchUpdateSource;
  now?: Date;
}): Promise<UpdateCheckSummary> => {
  const checked = components.filter(
    (component): component is UpdateComponent & { sourceUrl: string } =>
      component.sourceUrl !== null,
  );
  const bySource = new Map<string, string[]>();
  for (const component of checked) {
    bySource.set(component.sourceUrl, [
      ...(bySource.get(component.sourceUrl) ?? []),
      component.id,
    ]);
  }
  const urls = [...bySource.keys()];

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

  const outcomes = new Map<string, SourceOutcome>();
  await mapLimited(urls, SOURCE_CONCURRENCY, async url => {
    const previous = stored.get(url);
    const ids = bySource.get(url) ?? [];
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
      outcome = { document: previous?.document ?? null, error: errorOf(error) };
    }

    outcomes.set(url, outcome);

    if (outcome.error === null) {
      const values = {
        document: outcome.document,
        etag: validators?.etag ?? null,
        lastAttemptAt: now,
        lastError: null,
        lastModified: validators?.lastModified ?? null,
        lastSuccessAt: now,
      };
      await db
        .insert(core_update_sources)
        .values({ url, ...values })
        .onConflictDoUpdate({ set: values, target: core_update_sources.url });
    } else {
      await db
        .insert(core_update_sources)
        .values({ lastAttemptAt: now, lastError: outcome.error, url })
        .onConflictDoUpdate({
          set: { lastAttemptAt: now, lastError: outcome.error },
          target: core_update_sources.url,
        });
    }
  });

  const summary: UpdateCheckSummary = {
    securityUpdates: 0,
    components: checked.length,
    failedSources: [...outcomes.values()].filter(
      outcome => outcome.error !== null,
    ).length,
    sources: urls.length,
    updates: 0,
  };

  for (const component of checked) {
    const outcome = outcomes.get(component.sourceUrl);
    if (outcome === undefined) continue;

    if (outcome.error !== null) {
      // The failure is recorded; what was found before - and the versions it
      // was found for - stays exactly as it was.
      await db
        .insert(core_update_results)
        .values({
          channel: null,
          componentId: component.id,
          coreVersion,
          hasUnknownVersion: component.hasUnknownVersion,
          lastAttemptAt: now,
          lastError: outcome.error,
          result: null,
          sourceUrl: component.sourceUrl,
          versions: component.versions,
        })
        .onConflictDoUpdate({
          set: { lastAttemptAt: now, lastError: outcome.error },
          target: core_update_results.componentId,
        });
      continue;
    }

    const result = evaluateUpdate({
      channelOverride,
      coreVersion,
      entry: outcome.document.packages[component.id],
      installed: component,
      isCore: component.kind === "core",
    });
    summary.securityUpdates += result.securityUpdates.length;
    if (result.status === "update_available") summary.updates += 1;

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
    await db
      .insert(core_update_results)
      .values({ componentId: component.id, ...values })
      .onConflictDoUpdate({
        set: values,
        target: core_update_results.componentId,
      });
  }

  // Removed plugins, and plugins that dropped their update source, leave no
  // result behind; neither does a source nothing points to any more.
  const checkedIds = checked.map(component => component.id);
  await db
    .delete(core_update_results)
    .where(
      checkedIds.length === 0
        ? undefined
        : notInArray(core_update_results.componentId, checkedIds),
    );
  await db
    .delete(core_update_sources)
    .where(
      urls.length === 0 ? undefined : notInArray(core_update_sources.url, urls),
    );

  return summary;
};

export type LockedUpdateCheck =
  | {
      reason: Extract<UpdateCheckLease, { acquired: false }>["reason"];
      retryAfterSeconds: number;
      status: "busy";
    }
  | { status: "completed"; summary: UpdateCheckSummary };

/** Takes the shared lease, runs the check and always gives the lease back. */
export const runLockedUpdateCheck = async ({
  manual,
  ...options
}: Parameters<typeof checkForUpdates>[0] & {
  manual: boolean;
}): Promise<LockedUpdateCheck> => {
  const lease = await acquireUpdateCheckLease(options.db, {
    manual,
    now: options.now,
  });
  if (!lease.acquired) {
    return {
      reason: lease.reason,
      retryAfterSeconds: lease.retryAfterSeconds,
      status: "busy",
    };
  }

  try {
    return { status: "completed", summary: await checkForUpdates(options) };
  } finally {
    await releaseUpdateCheckLease(options.db, lease.owner);
  }
};
