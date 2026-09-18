// @vitest-environment node
import { describe, expect, it } from "vitest";

import { exampleApiPlugin } from "./config.api";
import { EXAMPLE_SETTINGS_PAGE_ID } from "./content/settings-page";

interface ModuleTree {
  modules?: ModuleTree[];
  name: string;
  routes: { route: { method: string; path: string } }[];
}

interface ExamplePlugin {
  editablePages: { id: string; permission: Record<string, string> }[];
  modules: ModuleTree[];
  permissionStaff?: {
    admin?: Record<string, unknown>;
    moderator?: Record<string, unknown>;
  };
}

const plugin = exampleApiPlugin() as unknown as ExamplePlugin;

const routePaths = (modules: readonly ModuleTree[], prefix = ""): string[] =>
  modules.flatMap(module => {
    const path = `${prefix}${module.name}`;

    return [
      ...module.routes.map(
        ({ route }) => `${route.method} /${path}${route.path}`,
      ),
      ...routePaths(module.modules ?? [], `${path}/`),
    ];
  });

describe("what the example plugin registers for its editable page", () => {
  it("registers the page itself, once", () => {
    expect(plugin.editablePages.map(page => page.id)).toStrictEqual([
      EXAMPLE_SETTINGS_PAGE_ID,
    ]);
  });

  it("declares the moderator permission that page is gated on", () => {
    expect(plugin.permissionStaff?.moderator).toStrictEqual({
      widgets: ["can_edit"],
    });
  });

  it("gates it on a moderator permission rather than an admin one", () => {
    expect(Object.keys(plugin.permissionStaff?.admin ?? {})).not.toContain(
      "widgets",
    );
  });
});

describe("what the example plugin leaves to core", () => {
  it("serves no layout route of its own: the page is saved through core's", () => {
    expect(
      routePaths(plugin.modules).filter(one => one.endsWith("/layout")),
    ).toStrictEqual([]);
  });
});
