import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminDashboardWidget } from "@/lib/plugin";
import type { VitNodeConfig } from "@/vitnode.config";

import { getDashboardWidgets } from "./get-dashboard-widgets";

const permissions = vi.hoisted((): { value: StaffPermissionSet } => ({
  value: { root: true, permissions: [] },
}));

/**
 * Mirrors the real message tree: core sits at the top level, plugins are
 * namespaced under their own id. Any other key throws, exactly like next-intl
 * reporting MISSING_MESSAGE.
 */
const messages = vi.hoisted(() => ({
  value: new Set([
    "@vitnode/blog.admin.dashboard.widgets.categories.content",
    "@vitnode/blog.title",
    "admin.dashboard.widgets.core-widget.title",
    "admin.global.nav.core",
    ...["stats", "wide", "open", "gated", "filed", "unlabelled"].map(
      id => `@vitnode/blog.admin.dashboard.widgets.${id}.title`,
    ),
  ]),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () =>
    Promise.resolve(
      Object.assign(
        (key: string) => {
          if (!messages.value.has(key)) {
            throw new Error(`MISSING_MESSAGE: ${key}`);
          }

          return key;
        },
        { has: (key: string) => messages.value.has(key) },
      ),
    ),
}));

vi.mock("@/lib/api/get-session-admin-api", () => ({
  getSessionAdminApi: async () =>
    Promise.resolve({ permissions: permissions.value }),
}));

// Stand in for core's real widgets so the test asserts the resolver, not the
// registry's contents.
vi.mock("./registry", () => ({
  coreDashboardWidgets: [{ id: "core-widget", component: () => null }],
}));

const pluginWidget = (
  id: string,
  overrides: Partial<AdminDashboardWidget> = {},
): AdminDashboardWidget => ({
  id,
  component: () => null,
  ...overrides,
});

const config = (widgets: AdminDashboardWidget[]) =>
  ({
    plugins: [{ pluginId: "@vitnode/blog", admin: { dashboard: { widgets } } }],
  }) as unknown as VitNodeConfig;

const byId = async (id: string, widgets: AdminDashboardWidget[]) => {
  const resolved = await getDashboardWidgets({
    vitNodeConfig: config(widgets),
  });
  const found = resolved.find(widget => widget.id === id);
  if (!found) throw new Error(`${id} was not resolved`);

  return found;
};

describe("getDashboardWidgets", () => {
  beforeEach(() => {
    permissions.value = { root: true, permissions: [] };
  });

  it("namespaces widget ids with the owning plugin id", async () => {
    const resolved = await getDashboardWidgets({
      vitNodeConfig: config([pluginWidget("stats")]),
    });

    expect(resolved.map(widget => widget.id)).toEqual([
      "@vitnode/core:core-widget",
      "@vitnode/blog:stats",
    ]);
  });

  // Regression: core's admin strings live at the top level, so prefixing them
  // with `@vitnode/core.` raised MISSING_MESSAGE for every core widget.
  it("resolves core titles from the top-level admin namespace", async () => {
    const widget = await byId("@vitnode/core:core-widget", []);

    expect(widget.title).toBe("admin.dashboard.widgets.core-widget.title");
  });

  it("resolves plugin titles from the plugin's own namespace", async () => {
    const widget = await byId("@vitnode/blog:stats", [pluginWidget("stats")]);

    expect(widget.title).toBe(
      "@vitnode/blog.admin.dashboard.widgets.stats.title",
    );
  });

  it("leaves desc undefined when no translation exists", async () => {
    const widget = await byId("@vitnode/blog:stats", [pluginWidget("stats")]);

    expect(widget.desc).toBeUndefined();
  });

  it("defaults span to minSpan and rows to 1", async () => {
    const widget = await byId("@vitnode/blog:wide", [
      pluginWidget("wide", { minSpan: 2 }),
    ]);

    expect(widget).toMatchObject({
      minSpan: 2,
      defaultSpan: 2,
      defaultRows: 1,
    });
  });

  // The resolver copies field by field, so an option it forgets is silently
  // lost - and `allowMultiple` going missing empties the panel instead of
  // erroring anywhere.
  it("carries the widget's own options through", async () => {
    const settingsComponent = () => null;
    const widget = await byId("@vitnode/blog:stats", [
      pluginWidget("stats", {
        allowMultiple: true,
        defaultEnabled: true,
        settingsComponent,
      }),
    ]);

    expect(widget).toMatchObject({
      allowMultiple: true,
      defaultEnabled: true,
      settingsComponent,
    });
  });

  it("files a widget under the plugin it came from", async () => {
    const widget = await byId("@vitnode/blog:stats", [pluginWidget("stats")]);

    expect(widget.category).toEqual({
      id: "@vitnode/blog",
      title: "@vitnode/blog.title",
    });
  });

  it("files a core widget under core", async () => {
    const widget = await byId("@vitnode/core:core-widget", []);

    expect(widget.category).toEqual({
      id: "@vitnode/core",
      title: "admin.global.nav.core",
    });
  });

  it("files a widget under its own category when it names one", async () => {
    const widget = await byId("@vitnode/blog:filed", [
      pluginWidget("filed", { category: "content" }),
    ]);

    expect(widget.category).toEqual({
      id: "@vitnode/blog:content",
      title: "@vitnode/blog.admin.dashboard.widgets.categories.content",
    });
  });

  // A plugin that ships a category without its translation should show up
  // oddly named, not take the whole dashboard down with MISSING_MESSAGE.
  it("falls back to the raw category id when it has no translation", async () => {
    const widget = await byId("@vitnode/blog:unlabelled", [
      pluginWidget("unlabelled", { category: "no-such-key" }),
    ]);

    expect(widget.category).toEqual({
      id: "@vitnode/blog:no-such-key",
      title: "no-such-key",
    });
  });

  it("keeps a widget whose permission the admin holds", async () => {
    permissions.value = {
      root: false,
      permissions: [
        {
          plugin: "@vitnode/blog",
          module: "posts",
          permission: "can_view",
        },
      ],
    };

    const resolved = await getDashboardWidgets({
      vitNodeConfig: config([
        pluginWidget("gated", {
          permission: { module: "posts", permission: "can_view" },
        }),
      ]),
    });

    expect(resolved.map(widget => widget.id)).toContain("@vitnode/blog:gated");
  });

  it("hides a widget whose permission the admin lacks", async () => {
    permissions.value = { root: false, permissions: [] };

    const resolved = await getDashboardWidgets({
      vitNodeConfig: config([
        pluginWidget("open"),
        pluginWidget("gated", {
          permission: { module: "posts", permission: "can_view" },
        }),
      ]),
    });

    expect(resolved.map(widget => widget.id)).toEqual([
      "@vitnode/core:core-widget",
      "@vitnode/blog:open",
    ]);
  });

  it("shows every widget to a root admin", async () => {
    const resolved = await getDashboardWidgets({
      vitNodeConfig: config([
        pluginWidget("gated", {
          permission: { module: "posts", permission: "can_view" },
        }),
      ]),
    });

    expect(resolved.map(widget => widget.id)).toContain("@vitnode/blog:gated");
  });
});
