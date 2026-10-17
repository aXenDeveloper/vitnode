import type { drizzle } from "drizzle-orm/postgres-js";

import type { UpdateCheckError } from "@/database/updates";
import type { UpdateChannel } from "@/lib/updates/manifest";

import { core_update_results, core_update_sources } from "@/database/updates";
import { channelOfVersion } from "@/lib/updates/manifest";

import type { UpdateComponent } from "./components";
import type { UpdateEvaluation } from "./evaluate";

import { evaluateUpdate } from "./evaluate";
import { readUpdateCheckLock } from "./lock";

type Db = ReturnType<typeof drizzle>;

export interface ComponentUpdateState {
  id: string;
  lastAttemptAt: Date | null;
  /** The last attempt for this component failed. Whatever `result` holds is from before it. */
  lastError: null | UpdateCheckError;
  lastSuccessAt: Date | null;
  result: null | UpdateEvaluation;
  sourceUrl: null | string;
  /**
   * `true` when the result was not checked for what runs now - a new version,
   * channel or core. It is recomputed from the publisher data stored by the
   * last successful check, so a security warning still shows, but no fresh
   * check has confirmed it yet.
   */
  stale: boolean;
  state: "checked" | "not_checked" | "unavailable";
}

export interface UpdatesOverview {
  channelOverride: null | UpdateChannel;
  components: ComponentUpdateState[];
  enabled: boolean;
  lastManualAt: Date | null;
  running: boolean;
}

const sameVersions = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((version, index) => version === b[index]);

/**
 * What the catalog shows. Reads stored results only - it never reaches out to
 * a publisher, so opening the page costs two small queries.
 */
export const loadUpdatesOverview = async ({
  channelOverride,
  components,
  coreVersion,
  db,
  enabled,
}: {
  channelOverride: null | UpdateChannel;
  components: readonly UpdateComponent[];
  coreVersion: null | string;
  db: Db;
  enabled: boolean;
}): Promise<UpdatesOverview> => {
  const lock = await readUpdateCheckLock(db);
  const unavailable = (component: UpdateComponent): ComponentUpdateState => ({
    id: component.id,
    lastAttemptAt: null,
    lastError: null,
    lastSuccessAt: null,
    result: null,
    sourceUrl: component.sourceUrl,
    stale: false,
    state: "unavailable",
  });

  if (!enabled) {
    return {
      channelOverride,
      components: components.map(unavailable),
      enabled,
      lastManualAt: lock.lastManualAt,
      running: lock.running,
    };
  }

  const [results, sources] = await Promise.all([
    db.select().from(core_update_results),
    db.select().from(core_update_sources),
  ]);
  const resultById = new Map(results.map(row => [row.componentId, row]));
  const sourceByUrl = new Map(sources.map(row => [row.url, row]));

  return {
    channelOverride,
    components: components.map((component): ComponentUpdateState => {
      if (component.sourceUrl === null) return unavailable(component);

      const row = resultById.get(component.id);
      const notChecked: ComponentUpdateState = {
        id: component.id,
        lastAttemptAt: row?.lastAttemptAt ?? null,
        lastError: row?.lastError ?? null,
        lastSuccessAt: null,
        result: null,
        sourceUrl: component.sourceUrl,
        stale: false,
        state: "not_checked",
      };
      // A result for another source answers a different question.
      if (row?.sourceUrl !== component.sourceUrl || row.result === null) {
        return notChecked;
      }

      const [newest] = component.versions;
      const channel =
        channelOverride ??
        (newest === undefined ? null : channelOfVersion(newest));
      const current =
        sameVersions(row.versions, component.versions) &&
        row.hasUnknownVersion === component.hasUnknownVersion &&
        row.coreVersion === coreVersion &&
        row.channel === channel;
      const checked = {
        ...notChecked,
        lastSuccessAt: row.lastSuccessAt,
        state: "checked" as const,
      };

      if (current) return { ...checked, result: row.result };

      const document = sourceByUrl.get(component.sourceUrl)?.document;
      if (!document) return notChecked;

      return {
        ...checked,
        result: evaluateUpdate({
          channelOverride,
          coreVersion,
          entry: document.packages[component.id],
          installed: component,
          isCore: component.kind === "core",
        }),
        stale: true,
      };
    }),
    enabled,
    lastManualAt: lock.lastManualAt,
    running: lock.running,
  };
};

/**
 * The few numbers every AdminCP surface shares - the navigation count, the
 * security banner, the dashboard widget - read off the same overview the
 * catalog shows, so they cannot disagree with it. Core counts as one
 * component and every plugin as one, whatever registrations it has.
 */
export interface UpdatesSummary {
  /** Components (core and plugins) a security update affects, each counted once. */
  affectedComponents: number;
  /** Components with a result - fresh, stale or kept from before a failed check. */
  checkedComponents: number;
  core: {
    /** The newer core release on its channel; `null` when there is none, or none is known. */
    latestVersion: null | string;
    state: ComponentUpdateState["state"];
  };
  enabled: boolean;
  /** Components whose last check failed. Their earlier result, if any, still counts. */
  failedComponents: number;
  /** The newest check attempt of any component, failed or not. */
  lastAttemptAt: Date | null;
  /** Components with an update source that no check has covered yet. */
  notCheckedComponents: number;
  /**
   * Every component with an update source has a result at least this recent:
   * the oldest of their last successful checks. `null` while any has none.
   */
  oldestSuccessAt: Date | null;
  pluginUpdatesAvailable: number;
  running: boolean;
  /** Some result was not checked for what runs now and is recomputed from stored publisher data. */
  stale: boolean;
  totalComponents: number;
  /** Components not known to be up to date or outdated: no update source, not checked, or a status that cannot tell. */
  unconfirmedComponents: number;
  /** Components with a newer release on their channel - core included. */
  updatesAvailable: number;
}

const isUpdateAvailable = (component: ComponentUpdateState): boolean =>
  component.result?.status === "update_available";

export const summarizeUpdates = (overview: UpdatesOverview): UpdatesSummary => {
  const { components } = overview;
  const [core, ...plugins] = components;
  const checkable = components.filter(
    component => component.state !== "unavailable",
  );
  const successes = checkable.map(component => component.lastSuccessAt);
  const attempts = components.flatMap(component =>
    component.lastAttemptAt === null ? [] : [component.lastAttemptAt],
  );

  return {
    affectedComponents: components.filter(
      component => (component.result?.securityUpdates.length ?? 0) > 0,
    ).length,
    checkedComponents: components.filter(
      component => component.state === "checked",
    ).length,
    core: {
      latestVersion:
        core !== undefined && isUpdateAvailable(core)
          ? (core.result?.latest?.version ?? null)
          : null,
      state: core?.state ?? "unavailable",
    },
    enabled: overview.enabled,
    failedComponents: components.filter(
      component => component.lastError !== null,
    ).length,
    lastAttemptAt:
      attempts.length === 0
        ? null
        : new Date(Math.max(...attempts.map(date => date.getTime()))),
    notCheckedComponents: components.filter(
      component => component.state === "not_checked",
    ).length,
    oldestSuccessAt:
      successes.length === 0 || successes.includes(null)
        ? null
        : new Date(
            Math.min(...successes.map(date => date?.getTime() ?? Infinity)),
          ),
    pluginUpdatesAvailable: plugins.filter(isUpdateAvailable).length,
    running: overview.running,
    stale: components.some(component => component.stale),
    totalComponents: components.length,
    unconfirmedComponents: components.filter(
      component =>
        component.result?.status !== "up_to_date" &&
        component.result?.status !== "update_available",
    ).length,
    updatesAvailable: components.filter(isUpdateAvailable).length,
  };
};
