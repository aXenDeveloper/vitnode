// @vitest-environment node
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { buildModule } from "./lib/module";
import { buildRoute, findAdminRoutesWithoutStaffPermission } from "./lib/route";
import { newBuildPluginApiCore } from "./plugin";

const ALLOWLIST = [
  "GET /admin/session",
  "GET /admin/staff/permission-catalog",
  "GET /admin/roles/list",
  "POST /admin/staff/entry/:type",
  "GET /admin/staff/entry/:type/:id",
  "PATCH /admin/staff/entry/:type/:id",
  "DELETE /admin/staff/entry/:type/:id",
  "POST /admin/ai/assist",
  "POST /admin/ai/assist/stream",
  "POST /admin/ai/assist/estimate",
  "GET /admin/ai/assist/available",
  "POST /admin/ai/assist/runs/:id/feedback",
  "GET /admin/ai/translation-sources",
  "PUT /admin/ai/translation-sources",
];

const ok = {
  200: {
    content: { "application/json": { schema: z.object({}) } },
    description: "OK",
  },
};

describe("findAdminRoutesWithoutStaffPermission", () => {
  it("reports an admin route only when it has no staff permission", () => {
    const guarded = buildRoute({
      pluginId: "@vitnode/core",
      adminStaffPermission: { module: "users", permission: "can_view" },
      route: { method: "get", path: "/guarded", responses: ok },
      handler: c => c.json({}, 200),
    });
    const open = buildRoute({
      pluginId: "@vitnode/core",
      route: { method: "get", path: "/open", responses: ok },
      handler: c => c.json({}, 200),
    });
    const app = new OpenAPIHono();
    app.route(
      "/admin",
      buildModule({
        pluginId: "@vitnode/core",
        name: "admin",
        routes: [guarded, open],
      }).hono,
    );
    app.route(
      "/public",
      buildModule({ pluginId: "@vitnode/core", name: "public", routes: [open] })
        .hono,
    );

    expect(findAdminRoutesWithoutStaffPermission(app)).toEqual([
      "GET /admin/open",
    ]);
  });
});

describe("core admin routes", () => {
  it("all require a staff permission, or are explicitly allowlisted", () => {
    expect(
      findAdminRoutesWithoutStaffPermission(newBuildPluginApiCore.hono),
    ).toEqual([...ALLOWLIST].sort());
  });
});
