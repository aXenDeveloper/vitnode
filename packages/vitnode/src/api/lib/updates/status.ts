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
  now = new Date(),
}: {
  channelOverride: null | UpdateChannel;
  components: readonly UpdateComponent[];
  coreVersion: null | string;
  db: Db;
  enabled: boolean;
  now?: Date;
}): Promise<UpdatesOverview> => {
  const lock = await readUpdateCheckLock(db, now);
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
