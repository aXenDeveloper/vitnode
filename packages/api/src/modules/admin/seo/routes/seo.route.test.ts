import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/lib/permission-staff";

import { core_audit_logs } from "@/database/audit";
import { seoSettingsUpdatedEvent } from "@/events/seo";
import { createSeoWorld, SEO_ADMIN } from "@/tests/seo";
import { sessionCookies } from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

const CAN_VIEW: PermissionsStaffArgs = {
  module: "seo",
  permission: "can_view",
  plugin: "@vitnode/core",
};
const CAN_MANAGE: PermissionsStaffArgs = {
  ...CAN_VIEW,
  permission: "can_manage",
};

const setup = async (permissions: PermissionsStaffArgs[]) => {
  const world = await createSeoWorld();
  await grantStaffPermissions(world.cache, {
    permissions,
    userId: SEO_ADMIN.userId,
  });

  const send = async (path: string, init: RequestInit = {}) =>
    await world.app.request(`/admin${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        cookie: sessionCookies(SEO_ADMIN, "admin"),
      },
    });
  const patch = async (body: unknown) =>
    await send("/settings", { body: JSON.stringify(body), method: "PATCH" });

  return { patch, send, world };
};

describe("SEO AdminCP routes", () => {
  it.each([
    ["GET", "/settings", []],
    ["GET", "/robots/preview", []],
    ["PATCH", "/settings", [CAN_VIEW]],
  ] satisfies [string, string, PermissionsStaffArgs[]][])(
    "refuses %s %s to an admin without the permission",
    async (method, path, permissions) => {
      const { send } = await setup(permissions);

      expect(
        (
          await send(path, {
            body: method === "GET" ? undefined : "{}",
            method,
          })
        ).status,
      ).toBe(403);
    },
  );

  it("shows the settings with every source's size to an admin who can view", async () => {
    const { send } = await setup([CAN_VIEW]);
    const response = await send("/settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      settings: { allowIndexing: true, sitemap: { disabledSources: [] } },
      siteOrigin: "http://localhost:3000",
      sources: [
        { enabled: true, error: false, files: 1, id: "static", urls: 2 },
        { enabled: true, error: false, files: 1, id: "docs", urls: 3 },
      ],
    });
  });

  it("previews the robots.txt the site serves", async () => {
    const { send, world } = await setup([CAN_VIEW]);
    const preview = await send("/robots/preview");

    expect(preview.status).toBe(200);
    expect(await preview.json()).toStrictEqual({
      content: await (await world.app.request("/robots")).text(),
      offline: false,
    });
  });

  it("refuses to disable a source that is not registered", async () => {
    const { patch, world } = await setup([CAN_VIEW, CAN_MANAGE]);

    expect(
      (await patch({ sitemap: { disabledSources: ["docs", "nope"] } })).status,
    ).toBe(400);
    expect(world.emit).not.toHaveBeenCalled();
  });

  it("takes a disabled source out of the sitemap at once, and records the change", async () => {
    const { patch, world } = await setup([CAN_VIEW, CAN_MANAGE]);
    // Warm the cached settings, so the save has to expire them.
    expect((await world.app.request("/sitemaps/docs-1.xml")).status).toBe(200);

    const response = await patch({ sitemap: { disabledSources: ["docs"] } });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      settings: { sitemap: { disabledSources: ["docs"] } },
      sources: [
        { enabled: true, id: "static" },
        { enabled: false, id: "docs" },
      ],
    });
    expect((await world.app.request("/sitemaps/docs-1.xml")).status).toBe(404);
    expect(await (await world.app.request("/sitemap")).text()).not.toContain(
      "docs-1.xml",
    );
    expect(world.emit).toHaveBeenCalledWith(
      seoSettingsUpdatedEvent,
      expect.objectContaining({
        changedById: SEO_ADMIN.userId,
        disabledSitemapSources: ["docs"],
      }),
    );
    expect(world.rows(core_audit_logs)).toHaveLength(1);
  });
});
