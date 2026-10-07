// @vitest-environment node
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { buildModule } from "./lib/module";
import { buildRoute, findAdminRoutesWithoutStaffPermission } from "./lib/route";
import { newBuildPluginApiCore } from "./plugin";

/**
 * Admin routes that check staff permissions somewhere other than
 * `adminStaffPermission`. Every entry needs a reason.
 */
const ALLOWLIST = [
  // The admin session itself - what the AdminCP reads before it knows anything
  // about the caller's permissions. Signed-in admin only.
  "GET /admin/session",
  // The static list of permissions every plugin declares, needed to render the
  // staff editor. No records, signed-in admin only.
  "GET /admin/staff/permission-catalog",
  // Handler-checked: any of several permissions may list roles.
  "GET /admin/roles/list",
  // Handler-checked: the permission depends on the `{type}` path parameter
  // (`staff_admins` or `staff_moderators`).
  "POST /admin/staff/entry/:type",
  "GET /admin/staff/entry/:type/:id",
  "PATCH /admin/staff/entry/:type/:id",
  "DELETE /admin/staff/entry/:type/:id",
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
    // Exact, so a stale allowlist entry fails as loudly as a new open route.
    expect(
      findAdminRoutesWithoutStaffPermission(newBuildPluginApiCore.hono),
    ).toEqual([...ALLOWLIST].sort());
  });
});
