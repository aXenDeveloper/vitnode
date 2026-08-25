// @vitest-environment node
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { buildModule } from "./module";
import { applyModuleTags, moduleTag, pluginTag } from "./openapi-tags";
import { buildRoute } from "./route";

const okResponse = {
  200: {
    content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    description: "ok",
  },
} as const;

const route = <P extends string>(pluginId: P, path: string, tags?: string[]) =>
  buildRoute({
    pluginId,
    route: { method: "get", path, responses: okResponse, tags },
    handler: c => c.json({ ok: true }, 200),
  });

/** The tags of every operation in the finished document, keyed by path. */
const documentTags = (app: OpenAPIHono) => {
  const document = app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: { title: "test", version: "0.0.0" },
  });

  return Object.fromEntries(
    Object.entries(document.paths).map(([path, methods]) => [
      path,
      methods.get?.tags,
    ]),
  );
};

describe("pluginTag", () => {
  it("drops the npm scope and title-cases the rest", () => {
    expect(pluginTag("@vitnode/core")).toBe("Core");
    expect(pluginTag("@acme/my-plugin")).toBe("My Plugin");
    expect(pluginTag("@vitnode/test_plugin")).toBe("Test Plugin");
    expect(pluginTag("blog")).toBe("Blog");
  });
});

describe("moduleTag", () => {
  it("formats the plugin and the module chain", () => {
    expect(moduleTag("@vitnode/core", ["users"])).toBe("(Core) - Users");
    expect(moduleTag("@vitnode/core", ["admin", "users"])).toBe(
      "(Core) - Admin / Users",
    );
    expect(moduleTag("@vitnode/blog", ["admin", "content", "blog_posts"])).toBe(
      "(Blog) - Admin / Content / Blog Posts",
    );
  });

  it("falls back to the plugin alone for a module-less route", () => {
    expect(moduleTag("@vitnode/core", [])).toBe("(Core)");
  });
});

describe("applyModuleTags", () => {
  it("replaces the plugin-only tag and keeps the route's own tags", () => {
    const module = buildModule({
      pluginId: "@vitnode/core",
      name: "users",
      routes: [route("@vitnode/core", "/", ["Auth"])],
    });

    expect(applyModuleTags(module, "@vitnode/core")).toEqual([
      "(Core) - Users",
    ]);
    expect(module.routes[0]?.route.tags).toEqual(["(Core) - Users", "Auth"]);
  });

  it("names every parent module, so repeated leaf names stay apart", () => {
    const publicUsers = buildModule({
      pluginId: "@vitnode/core",
      name: "users",
      routes: [route("@vitnode/core", "/session")],
    });
    const adminUsers = buildModule({
      pluginId: "@vitnode/core",
      name: "users",
      routes: [route("@vitnode/core", "/list")],
    });
    const admin = buildModule({
      pluginId: "@vitnode/core",
      name: "admin",
      routes: [route("@vitnode/core", "/dashboard")],
      modules: [adminUsers],
    });

    expect([
      ...applyModuleTags(publicUsers, "@vitnode/core"),
      ...applyModuleTags(admin, "@vitnode/core"),
    ]).toEqual(["(Core) - Users", "(Core) - Admin", "(Core) - Admin / Users"]);
  });

  it("skips a module that only mounts other modules", () => {
    const leaf = buildModule({
      pluginId: "@vitnode/core",
      name: "cron",
      routes: [route("@vitnode/core", "/")],
    });
    const advanced = buildModule({
      pluginId: "@vitnode/core",
      name: "advanced",
      routes: [],
      modules: [leaf],
    });

    expect(applyModuleTags(advanced, "@vitnode/core")).toEqual([
      "(Core) - Advanced / Cron",
    ]);
  });

  it("retags the copies a nested module already left in its parents", () => {
    // `OpenAPIHono#route` shallow-copies each registered route, so by now the
    // same operation sits in three registries. Tagging has to reach all of them.
    const leaf = buildModule({
      pluginId: "@vitnode/core",
      name: "cron",
      routes: [route("@vitnode/core", "/run")],
    });
    const advanced = buildModule({
      pluginId: "@vitnode/core",
      name: "advanced",
      routes: [],
      modules: [leaf],
    });
    const admin = buildModule({
      pluginId: "@vitnode/core",
      name: "admin",
      routes: [route("@vitnode/core", "/session")],
      modules: [advanced],
    });

    applyModuleTags(admin, "@vitnode/core");

    const app = new OpenAPIHono();
    app.route("/core", admin.hono);

    expect(documentTags(app)).toEqual({
      "/core/session": ["(Core) - Admin"],
      "/core/advanced/cron/run": ["(Core) - Admin / Advanced / Cron"],
    });
  });

  it("is a no-op when run twice on the same module", () => {
    const module = buildModule({
      pluginId: "@vitnode/core",
      name: "users",
      routes: [route("@vitnode/core", "/")],
    });

    applyModuleTags(module, "@vitnode/core");
    applyModuleTags(module, "@vitnode/core");

    expect(module.routes[0]?.route.tags).toEqual(["(Core) - Users"]);
  });
});
