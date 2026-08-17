import { inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/config";
import { core_cron } from "@/database/cron";
import { core_queue } from "@/database/queue";
import { getQueueStatus } from "@/lib/api/get-queue-status";
import { isCronStale } from "@/lib/api/is-cron-stale";
import { INSECURE_DEFAULT_CRON_SECRET } from "@/lib/config";
import { isRealtimePubSubEnabled, isWebSocketEnabled } from "@/ws/registry";

import { buildRoute } from "../../../../lib/route";

export const integrationsDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Report whether the core integrations (AI, WebSocket, Redis, Email, Captcha, Cron) are active on the server.",
    path: "/integrations",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ai: z.object({
                // `true` when at least one AI language model is configured
                // (`buildApiConfig({ ai: { models } })`).
                active: z.boolean(),
                // Configured AI language models (id + display name). The first
                // entry is the default. Used to populate the "Test AI" dialog.
                models: z.array(z.object({ id: z.string(), name: z.string() })),
              }),
              captcha: z.object({
                active: z.boolean(),
                type: z
                  .enum(["cloudflare_turnstile", "recaptcha_v3"])
                  .nullable(),
              }),
              contentPreview: z.object({
                // `true` when at least one content type has
                // `editorial.preview.enabled`, i.e. the preview routes exist.
                active: z.boolean(),
                // How many content types can mint preview links.
                contentTypes: z.number(),
              }),
              cron: z.object({
                // `true` when a cron adapter is configured, i.e. an in-process
                // scheduler is running the registered jobs automatically.
                active: z.boolean(),
                // Registered cron jobs. Always >= 1 since core ships a job.
                jobs: z.number(),
                // ISO timestamp of the most recent cron execution, or `null`
                // when no job has run yet.
                lastRun: z.string().nullable(),
                // `false` when `CRON_SECRET` is left at its well-known default,
                // which leaves the cron endpoint effectively unauthenticated.
                secure: z.boolean(),
                // `true` when no job has run within the staleness window, i.e.
                // the scheduler looks misconfigured or stopped even though jobs
                // are registered.
                stale: z.boolean(),
              }),
              email: z.object({
                active: z.boolean(),
              }),
              queue: z.object({
                // `true` when at least one handler is registered AND a cron
                // adapter is configured AND its scheduler is running - the queue
                // is drained by cron, so with cron off (or stale) tasks pile up
                // unprocessed and the queue is reported inactive.
                active: z.boolean(),
                // `true` when handlers are registered but the queue is offline
                // because the cron worker that drains it isn't running.
                cronStale: z.boolean(),
                // Number of pending tasks waiting to be processed.
                pending: z.number(),
                // Number of tasks currently being processed.
                processing: z.number(),
                // Registered queue task handlers across core + plugins.
                tasks: z.number(),
              }),
              redis: z.object({
                active: z.boolean(),
                // `true` when Redis is configured but currently unreachable - a
                // problem worth surfacing distinctly from "not set up at all".
                configuredButDown: z.boolean(),
              }),
              storage: z.object({
                // `true` when a storage adapter is configured, i.e. file
                // uploads are enabled.
                active: z.boolean(),
              }),
              websocket: z.object({
                active: z.boolean(),
                crossInstance: z.boolean(),
              }),
            }),
          },
        },
        description: "Integration statuses",
      },
    },
  },
  handler: async c => {
    const core = c.get("core");
    const captcha = core.captcha;
    const redis = await c.get("cache").status();

    const queueGrouped = await c
      .get("db")
      .select({
        status: core_queue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(core_queue)
      .where(inArray(core_queue.status, ["pending", "processing"]))
      .groupBy(core_queue.status);
    const queuePending =
      queueGrouped.find(row => row.status === "pending")?.count ?? 0;
    const queueProcessing =
      queueGrouped.find(row => row.status === "processing")?.count ?? 0;

    // Freshest cron heartbeat: a job's last successful run, or its creation
    // time while it's never run so a brand-new install isn't flagged stale
    // during the grace period before the first tick.
    const [cronActivity] = await c
      .get("db")
      .select({
        lastRun: sql<Date | null>`max(${core_cron.lastRun})`,
        lastActivity: sql<Date | null>`max(coalesce(${core_cron.lastRun}, ${core_cron.createdAt}))`,
      })
      .from(core_cron);

    const cronLastRun = cronActivity?.lastRun
      ? new Date(cronActivity.lastRun)
      : null;
    const cronStale = isCronStale(
      cronActivity?.lastActivity ? new Date(cronActivity.lastActivity) : null,
    );
    const cronActive = core.hasCronAdapter;
    const previewContentTypes = core.contentTypes.filter(
      entry => entry.definition.editorial.preview.enabled,
    ).length;
    const queueStatus = getQueueStatus({
      cronActive,
      cronStale,
      hasTaskHandlers: core.queue.length > 0,
    });

    return c.json(
      {
        ai: {
          active: (core.ai?.models.length ?? 0) > 0,
          models: c
            .get("ai")
            .models()
            .map(({ id, name }) => ({ id, name })),
        },
        captcha: {
          active: !!(captcha?.secretKey && captcha.siteKey),
          type: captcha?.type ?? null,
        },
        contentPreview: {
          active: previewContentTypes > 0,
          contentTypes: previewContentTypes,
        },
        cron: {
          active: cronActive,
          jobs: core.cron.length,
          lastRun: cronLastRun ? cronLastRun.toISOString() : null,
          secure:
            !!core.cronSecret &&
            core.cronSecret !== INSECURE_DEFAULT_CRON_SECRET,
          stale: cronStale,
        },
        email: {
          active: !!core.email?.adapter,
        },
        queue: {
          active: queueStatus.active,
          cronStale: queueStatus.cronStale,
          pending: queuePending,
          processing: queueProcessing,
          tasks: core.queue.length,
        },
        redis: {
          active: redis.configured && redis.connected,
          configuredButDown: redis.configured && !redis.connected,
        },
        storage: {
          active: !!core.storage?.adapter,
        },
        websocket: {
          active: isWebSocketEnabled(),
          crossInstance: isRealtimePubSubEnabled(),
        },
      },
      200,
    );
  },
});
