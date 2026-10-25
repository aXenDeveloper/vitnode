import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { ogImageLocalCache } from "@/og-image/server/cache";
import { resolveOgImagesConfig } from "@/og-image/server/config";
import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import {
  ogImagesSeoAdminRoute,
  previewOgImageSeoAdminRoute,
} from "./og-images.route";

const ADMIN = { id: 1, roleId: 1 };

const SEO_VIEW: PermissionsStaffArgs = {
  module: "seo",
  permission: "can_view",
  plugin: "@vitnode/core",
};

const OTHER_VIEW: PermissionsStaffArgs = {
  module: "system",
  permission: "can_view",
  plugin: "@vitnode/core",
};

const appWith = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("core", {
      i18n: {
        defaultLocale: "en",
        locales: [{ code: "en", name: "English" }],
      },
      ogImages: resolveOgImagesConfig({}, { title: "VitNode" }),
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(
    ogImagesSeoAdminRoute.route,
    ogImagesSeoAdminRoute.handler as never,
  );
  app.openapi(
    previewOgImageSeoAdminRoute.route,
    previewOgImageSeoAdminRoute.handler,
  );

  return app;
};

const preview = async (app: OpenAPIHono, template = "default") => {
  const form = new FormData();
  form.set("template", template);
  form.set("title", "Hello world");

  return await app.request("/og-images/preview", {
    body: form,
    method: "POST",
  });
};

beforeEach(() => {
  ogImageLocalCache.clear();
});

describe.each([
  [
    "GET /og-images",
    async (app: OpenAPIHono) => await app.request("/og-images"),
  ],
  ["POST /og-images/preview", preview],
])("%s", (_label, send) => {
  it("refuses an administrator without the SEO permission", async () => {
    const app = await appWith([OTHER_VIEW]);

    expect((await send(app)).status).toBe(403);
  });

  it("is allowed with the SEO view permission", async () => {
    const app = await appWith([SEO_VIEW]);

    expect((await send(app)).status).toBe(200);
  });
});

describe("POST /og-images/preview", () => {
  it("returns a PNG that no cache may keep", async () => {
    const response = await preview(await appWith([SEO_VIEW]));

    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("answers 400 for a template that is not registered", async () => {
    const response = await preview(await appWith([SEO_VIEW]), "missing");

    expect(response.status).toBe(400);
  });
});
