import type { DebugTab } from "@/tanstack/admin/debug/route-search";
import type { DebugSystemTab } from "@/tanstack/admin/debug/tabs";
import type { CronHealth } from "@/views/admin/views/core/advanced/cron/cron-query";
import type { SearchIndexStatus } from "@/views/admin/views/core/advanced/search/search-index-query";
import type { AdminIntegrations } from "@/views/admin/views/core/system/integrations/integrations-query";
import type {
  AdminComponentUpdate,
  AdminPluginUpdates,
} from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import type {
  AdminInstalledPlugin,
  AdminInstalledPlugins,
} from "@/views/admin/views/core/system/plugins/plugins-query";

import type { DebugQueueSnapshot } from "../debug-query";

export type DebugTone = "critical" | "off" | "ok" | "warn";

export interface DebugSources {
  cronHealth?: CronHealth;
  installed?: AdminInstalledPlugins;
  integrations?: AdminIntegrations;
  queue?: DebugQueueSnapshot;
  search?: SearchIndexStatus;
  updates?: AdminPluginUpdates;
}

export const PLUGIN_PROBLEMS = [
  "security_update",
  "version_mismatch",
  "update_available",
  "source_unreachable",
] as const;

export type PluginProblemKind = (typeof PLUGIN_PROBLEMS)[number];

export const DEBUG_SERVICES = [
  "email",
  "storage",
  "ai",
  "captcha",
  "websocket",
] as const;

export type DebugService = (typeof DEBUG_SERVICES)[number];

export type DebugMessageKey =
  | "cache.memory"
  | "cache.redis_connected"
  | "cache.redis_down"
  | "cache.subtitle_memory"
  | "cache.subtitle_redis"
  | "cron.failed_tasks"
  | "cron.insecure_secret"
  | "cron.ok"
  | "cron.overdue"
  | "cron.stopped"
  | "cron.subtitle_adapter"
  | "cron.subtitle_external"
  | "plugins.ok"
  | "plugins.subtitle"
  | "search.engine_down"
  | "search.incomplete"
  | "search.ok"
  | "search.subtitle"
  | "search.sync_errors"
  | "services.subtitle"
  | "vitnode.not_checked"
  | "vitnode.security_update"
  | "vitnode.source_unreachable"
  | "vitnode.subtitle"
  | "vitnode.up_to_date"
  | "vitnode.update_available"
  | `plugins.problem.${PluginProblemKind}`
  | `plugins.summary.${PluginProblemKind}`
  | `services.${DebugService}`;

export interface DebugMessage {
  key: DebugMessageKey;
  values?: Record<string, number | string>;
}

export interface DebugCheck {
  area: DebugSystemTab;
  detail?: string;
  id: string;
  message: DebugMessage;
  tab: DebugTab;
  tone: DebugTone;
}

export interface DebugArea {
  checks: DebugCheck[];
  id: DebugSystemTab;
  subtitle: DebugMessage;
  tone: DebugTone;
}

export interface DebugHealth {
  areas: DebugArea[];
  issues: DebugCheck[];
}

const TONE_RANK: Record<DebugTone, number> = {
  off: 0,
  ok: 1,
  warn: 2,
  critical: 3,
};

export const isProblem = (tone: DebugTone): boolean =>
  tone === "critical" || tone === "warn";

const worstTone = (tones: DebugTone[]): DebugTone =>
  tones.reduce<DebugTone>(
    (worst, tone) => (TONE_RANK[tone] > TONE_RANK[worst] ? tone : worst),
    "off",
  );

export const coreSecurityUpdate = (updates: AdminPluginUpdates | undefined) => {
  const result = updates?.core.result;
  const [securityUpdate] = result?.securityUpdates ?? [];
  if (!result || !securityUpdate) return null;

  return {
    count: result.securityUpdates.length,
    fixedVersion: result.latest?.version ?? securityUpdate.fixed,
    latest: result.latest,
    securityUpdate,
  };
};

const vitnodeChecks = (
  installed: AdminInstalledPlugins,
  updates: AdminPluginUpdates | undefined,
): DebugCheck[] => {
  const check = (
    id: string,
    tone: DebugTone,
    message: DebugMessage,
    detail?: string,
  ): DebugCheck => ({
    area: "vitnode",
    detail,
    id,
    message,
    tab: "vitnode",
    tone,
  });
  const core = updates?.core;
  const security = coreSecurityUpdate(updates);

  if (security) {
    return [
      check(
        "vitnode-security-update",
        "critical",
        {
          key: "vitnode.security_update",
          values: { version: security.fixedVersion ?? "" },
        },
        security.securityUpdate.id,
      ),
    ];
  }
  if (core?.result?.status === "update_available") {
    return [
      check("vitnode-update", "warn", {
        key: "vitnode.update_available",
        values: { version: core.result.latest?.version ?? "" },
      }),
    ];
  }
  if (core?.lastError) {
    return [
      check(
        "vitnode-source",
        "warn",
        { key: "vitnode.source_unreachable" },
        [core.lastError.code, core.lastError.detail].filter(Boolean).join(" "),
      ),
    ];
  }
  if (!core || core.state !== "checked") {
    return [
      check("vitnode-not-checked", "off", { key: "vitnode.not_checked" }),
    ];
  }

  return [
    check("vitnode-latest", "ok", {
      key: "vitnode.up_to_date",
      values: { version: installed.core.version },
    }),
  ];
};

export interface PluginProblem {
  kind: PluginProblemKind;
  tone: "critical" | "warn";
  values?: Record<string, string>;
}

export const pluginProblem = (
  plugin: AdminInstalledPlugin,
  update: AdminComponentUpdate | undefined,
): null | PluginProblem => {
  if (update?.result?.securityUpdates.length) {
    return { kind: "security_update", tone: "critical" };
  }
  if (plugin.versionMismatch) {
    return { kind: "version_mismatch", tone: "warn" };
  }
  if (update?.result?.status === "update_available") {
    return {
      kind: "update_available",
      tone: "warn",
      values: { version: update.result.latest?.version ?? "" },
    };
  }
  if (update?.lastError) {
    return { kind: "source_unreachable", tone: "warn" };
  }

  return null;
};

const pluginChecks = (
  installed: AdminInstalledPlugins,
  updates: AdminPluginUpdates | undefined,
): DebugCheck[] => {
  const grouped = new Map<
    PluginProblemKind,
    { names: string[]; tone: DebugTone }
  >();
  for (const plugin of installed.plugins) {
    const problem = pluginProblem(
      plugin,
      updates?.plugins.find(update => update.id === plugin.id),
    );
    if (!problem) continue;
    const group = grouped.get(problem.kind) ?? {
      names: [],
      tone: problem.tone,
    };
    group.names.push(plugin.title);
    grouped.set(problem.kind, group);
  }

  if (grouped.size === 0) {
    return [
      {
        area: "plugins",
        id: "plugins-ok",
        message: {
          key: "plugins.ok",
          values: { count: installed.plugins.length },
        },
        tab: "plugins",
        tone: "ok",
      },
    ];
  }

  return [...grouped.entries()].map(([kind, group]) => ({
    area: "plugins",
    detail: group.names.join(", "),
    id: `plugins-${kind}`,
    message: {
      key: `plugins.summary.${kind}`,
      values: { count: group.names.length },
    },
    tab: "plugins",
    tone: group.tone,
  }));
};

const cronChecks = (
  cronHealth: CronHealth,
  integrations: AdminIntegrations | undefined,
  queue: DebugQueueSnapshot | undefined,
): DebugCheck[] => {
  const checks: DebugCheck[] = [];
  const check = (
    id: string,
    tone: DebugTone,
    message: DebugMessage,
    tab: DebugTab = "cron",
  ) => {
    checks.push({ area: "cron", id, message, tab, tone });
  };

  if (cronHealth.secretRejected || integrations?.cron.secure === false) {
    check("cron-secret", "critical", { key: "cron.insecure_secret" });
  }
  if (cronHealth.stale) {
    check("cron-stopped", "critical", { key: "cron.stopped" });
  }
  if (cronHealth.overdueJobs > 0) {
    check("cron-overdue", "warn", {
      key: "cron.overdue",
      values: { count: cronHealth.overdueJobs },
    });
  }
  if (queue && queue.counts.failed > 0) {
    check(
      "queue-failed",
      "warn",
      { key: "cron.failed_tasks", values: { count: queue.counts.failed } },
      "queue",
    );
  }
  if (checks.length === 0) {
    check("cron-ok", "ok", {
      key: "cron.ok",
      values: { count: cronHealth.jobs },
    });
  }

  return checks;
};

const cacheChecks = (integrations: AdminIntegrations): DebugCheck[] => {
  const check = (
    id: string,
    tone: DebugTone,
    key: DebugMessageKey,
  ): DebugCheck[] => [
    { area: "cache", id, message: { key }, tab: "cache", tone },
  ];

  if (integrations.redis.configuredButDown) {
    return check("cache-redis-down", "critical", "cache.redis_down");
  }

  return integrations.redis.active
    ? check("cache-redis", "ok", "cache.redis_connected")
    : check("cache-memory", "off", "cache.memory");
};

const searchChecks = (search: SearchIndexStatus): DebugCheck[] => {
  const checks: DebugCheck[] = [];
  const check = (
    id: string,
    tone: DebugTone,
    message: DebugMessage,
    detail?: string,
  ) => {
    checks.push({ area: "search", detail, id, message, tab: "search", tone });
  };

  if (!search.healthy) {
    check("search-down", "critical", {
      key: "search.engine_down",
      values: { engine: search.engine },
    });
  }
  const incomplete = search.collections.filter(
    collection =>
      collection.total !== null && collection.indexed < collection.total,
  );
  if (incomplete.length > 0) {
    check(
      "search-incomplete",
      "warn",
      { key: "search.incomplete", values: { count: incomplete.length } },
      incomplete
        .map(
          collection =>
            `${collection.itemType} ${String(collection.indexed)}/${String(collection.total)}`,
        )
        .join(" · "),
    );
  }
  if (search.syncErrors.length > 0) {
    check("search-sync", "warn", {
      key: "search.sync_errors",
      values: { count: search.syncErrors.length },
    });
  }
  if (checks.length === 0) {
    check("search-ok", "ok", {
      key: "search.ok",
      values: { count: search.total },
    });
  }

  return checks;
};

export const isServiceActive = (
  integrations: AdminIntegrations,
  service: DebugService,
): boolean => integrations[service].active;

const serviceChecks = (integrations: AdminIntegrations): DebugCheck[] =>
  DEBUG_SERVICES.map(service => ({
    area: "services",
    id: `service-${service}`,
    message: { key: `services.${service}` as const },
    tab: "services",
    tone: isServiceActive(integrations, service) ? "ok" : "off",
  }));

const area = (
  id: DebugSystemTab,
  subtitle: DebugMessage,
  checks: DebugCheck[],
): DebugArea => ({
  checks,
  id,
  subtitle,
  tone: worstTone(checks.map(check => check.tone)),
});

export const debugHealth = ({
  cronHealth,
  installed,
  integrations,
  queue,
  search,
  updates,
}: DebugSources): DebugHealth => {
  const areas: DebugArea[] = [];

  if (installed) {
    areas.push(
      area(
        "vitnode",
        {
          key: "vitnode.subtitle",
          values: { version: installed.core.version },
        },
        vitnodeChecks(installed, updates),
      ),
      area(
        "plugins",
        {
          key: "plugins.subtitle",
          values: { count: installed.plugins.length },
        },
        pluginChecks(installed, updates),
      ),
    );
  }
  if (cronHealth) {
    areas.push(
      area(
        "cron",
        {
          key: cronHealth.active
            ? "cron.subtitle_adapter"
            : "cron.subtitle_external",
        },
        cronChecks(cronHealth, integrations, queue),
      ),
    );
  }
  if (integrations) {
    areas.push(
      area(
        "cache",
        {
          key: integrations.redis.active
            ? "cache.subtitle_redis"
            : "cache.subtitle_memory",
        },
        cacheChecks(integrations),
      ),
    );
  }
  if (search) {
    areas.push(
      area(
        "search",
        { key: "search.subtitle", values: { engine: search.engine } },
        searchChecks(search),
      ),
    );
  }
  if (integrations) {
    const active = DEBUG_SERVICES.filter(service =>
      isServiceActive(integrations, service),
    ).length;
    areas.push(
      area(
        "services",
        {
          key: "services.subtitle",
          values: { active, total: DEBUG_SERVICES.length },
        },
        serviceChecks(integrations),
      ),
    );
  }

  const issues = areas
    .flatMap(entry => entry.checks)
    .filter(check => isProblem(check.tone))
    .sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);

  return { areas, issues };
};
