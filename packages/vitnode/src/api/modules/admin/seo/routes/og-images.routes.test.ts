import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { resolveOgImagesConfig } from "@/og-image/config";
import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import {
  listOgImageTemplatesAdminRoute,
  previewOgImageAdminRoute,
} from "./og-images.routes";

const ADMIN = { id: 1, roleId: 1 };

const SEO_VIEW: PermissionsStaffArgs = {
  module: "seo",
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
        locales: [
          { code: "en", name: "English" },
          { code: "de", enabled: false, name: "Deutsch" },
        ],
      },
      metadata: { title: "VitNode" },
      ogImages: resolveOgImagesConfig({}),
    } as unknown as Context["var"]["core"]);
    await next();
  });
  for (const { handler, route } of [
    listOgImageTemplatesAdminRoute,
    previewOgImageAdminRoute,
  ]) {
    app.openapi(route, handler);
  }

  return app;
};

const preview = async (app: OpenAPIHono, template = "default") => {
  const body = new FormData();
  body.set("template", template);
  body.set("title", "Hello world");
  body.set("locale", "pl");

  return await app.request("/og-images/preview", { body, method: "POST" });
};

describe("AdminCP Open Graph images", () => {
  it.each([
    [
      "GET /og-images",
      async (app: OpenAPIHono) => await app.request("/og-images"),
    ],
    ["POST /og-images/preview", preview],
  ])("refuses %s without seo.can_view", async (_label, call) => {
    const app = await appWith([]);

    expect((await call(app)).status).toBe(403);
  });

  it("lists the templates and the enabled languages", async () => {
    const app = await appWith([SEO_VIEW]);

    const response = await app.request("/og-images");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toStrictEqual({
      defaultTemplate: "default",
      enabled: true,
      locales: [{ code: "en", name: "English" }],
      templates: [
        { id: "default", isDefault: true, version: expect.any(String) },
      ],
    });
  });

  it("draws a preview that is never cached", async () => {
    const app = await appWith([SEO_VIEW]);

    const response = await preview(app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("refuses an unknown template instead of drawing the default", async () => {
    const app = await appWith([SEO_VIEW]);

    expect((await preview(app, "removed")).status).toBe(400);
  });
});
