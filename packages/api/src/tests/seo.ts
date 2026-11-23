import type { Context, Next } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";

import type { SitemapEntry, SitemapSource } from "@/lib/seo/sitemap";
import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/middlewares/global.middleware";

import { core_seo_settings } from "@/database/seo";
import { core_site_status } from "@/database/site";
import { createLocaleRouting } from "@/lib/i18n/locale-routing";
import { resolveSeoConfig } from "@/lib/seo/config";
import { globalAdminMiddleware } from "@/middlewares/global.middleware";
import { seoAdminModule } from "@/modules/admin/seo/seo.module";
import { seoModule } from "@/modules/seo/seo.module";

import { createSessionWorld, fakeSession } from "./sessions";

/** A plugin source of `size` pages, `/docs/1` and on. */
export const testDocsSitemapSource = (size: number): SitemapSource => ({
  count: async () => await Promise.resolve(size),
  getEntries: async (_c, { limit, offset }) =>
    await Promise.resolve(
      Array.from(
        { length: Math.max(0, Math.min(limit, size - offset)) },
        (_, index): SitemapEntry => ({ loc: `/docs/${offset + index + 1}` }),
      ),
    ),
  id: "docs",
  label: "Docs",
});

export const SEO_ADMIN = fakeSession(1, { id: 1, publicId: "laptop" });

/**
 * The public SEO routes at the root and the AdminCP ones under `/admin`, on an
 * in-memory database with an English and Polish site whose sitemap holds the
 * static source and a `docs` source of `docsSize` pages.
 */
export const createSeoWorld = async ({
  docsSize = 3,
  settings,
  siteStatus,
}: {
  docsSize?: number;
  settings?: Partial<typeof core_seo_settings.$inferInsert>;
  siteStatus?: Partial<typeof core_site_status.$inferInsert>;
} = {}) => {
  const world = await createSessionWorld({
    extraTables: [
      [
        core_seo_settings,
        settings
          ? [
              {
                allowIndexing: true,
                blockAiCrawlers: false,
                customRobots: "",
                disabledSitemapSources: [],
                id: 1,
                sitemapEnabled: true,
                sitemapMaxUrls: 10_000,
                ...settings,
              },
            ]
          : [],
      ],
      [
        core_site_status,
        siteStatus
          ? [
              {
                changedAt: new Date(),
                id: 1,
                message: [],
                offline: false,
                opensAt: null,
                showCountdown: true,
                ...siteStatus,
              },
            ]
          : [],
      ],
    ],
    sessions: [SEO_ADMIN],
  });
  const seo = resolveSeoConfig({
    config: { sitemap: { sources: [testDocsSitemapSource(docsSize)] } },
    contentSources: [],
    plugins: [],
  });
  const localeRouting = createLocaleRouting({
    defaultLocale: "en",
    locales: ["en", "pl"],
  });

  world.app.use("*", async (c: Context<EnvVitNode>, next: Next) => {
    c.set("core", {
      ...c.get("core"),
      i18n: { localeRouting },
      seo,
    } as unknown as EnvVariablesVitNode["core"]);
    await next();
  });
  for (const { handler, hook, route } of seoModule.routes) {
    world.app.openapi(route as never, handler as never, hook as never);
  }
  const admin = new OpenAPIHono<EnvVitNode>();
  admin.use("*", globalAdminMiddleware());
  for (const { handler, hook, route } of seoAdminModule.routes) {
    admin.openapi(route as never, handler as never, hook as never);
  }
  world.app.route("/admin", admin);

  return world;
};
