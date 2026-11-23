import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { seoSettingsUpdatedEvent } from "@/events/seo";
import { auditDiff } from "@/lib/audit/diff";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { getSitemapSources } from "@/lib/seo/serve.server";
import { mergeSeoSettings, zodSeoSettingsUpdate } from "@/lib/seo/settings";
import {
  afterSeoSettingsSaved,
  loadSeoSettings,
  saveSeoSettings,
} from "@/lib/seo/settings.server";

import { readSeoAdminSettings } from "../admin-settings.server";
import { zodSeoAdminSettings } from "../seo.schema";

export const updateSeoSettingsAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.seo.canManage,
  route: {
    method: "patch",
    description:
      "Change any of the SEO settings; fields left out keep their saved values.",
    path: "/settings",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodSeoSettingsUpdate } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodSeoAdminSettings } },
        description: "Saved; the settings as they are now",
      },
      400: { description: "A disabled source id is not registered" },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    const next = mergeSeoSettings(await loadSeoSettings(c), body);
    const known = new Set(getSitemapSources(c).map(source => source.id));
    const unknown = body.sitemap?.disabledSources?.filter(id => !known.has(id));
    if (unknown?.length) {
      throw new HTTPException(400, {
        message: `Unknown sitemap source: ${unknown.join(", ")}.`,
      });
    }

    await c.get("db").transaction(async tx => {
      const before = await saveSeoSettings(tx, next, admin.user.id);
      const flatten = (settings: typeof next) => ({
        allowIndexing: settings.allowIndexing,
        blockAiCrawlers: settings.blockAiCrawlers,
        customRobots: settings.customRobots,
        disabledSitemapSources: settings.sitemap.disabledSources.join(", "),
        sitemapEnabled: settings.sitemap.enabled,
        sitemapMaxUrls: settings.sitemap.maxUrlsPerFile,
      });
      const changes = auditDiff({
        after: flatten(next),
        before: flatten(before),
        include: [
          "allowIndexing",
          "blockAiCrawlers",
          "customRobots",
          "disabledSitemapSources",
          "sitemapEnabled",
          "sitemapMaxUrls",
        ],
      });
      if (changes) {
        await writeAuditLog(
          c,
          {
            action: "settings.updated",
            changes,
            target: { id: "seo", label: "SEO", type: "settings" },
          },
          tx,
        );
      }
    });

    await afterSeoSettingsSaved(c);
    await c.get("events").emit(seoSettingsUpdatedEvent, {
      allowIndexing: next.allowIndexing,
      blockAiCrawlers: next.blockAiCrawlers,
      changedById: admin.user.id,
      disabledSitemapSources: next.sitemap.disabledSources,
      sitemapEnabled: next.sitemap.enabled,
    });

    return c.json(await readSeoAdminSettings(c), 200);
  },
});
