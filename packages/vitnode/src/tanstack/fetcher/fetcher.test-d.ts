import { z } from "@hono/zod-openapi";
import { describe, expectTypeOf, it } from "vitest";

import type { ApiPluginContract } from "@/lib/fetcher/contract";

import { buildModule } from "@/api/lib/module";
import { buildApiPlugin } from "@/api/lib/plugin";
import { buildRoute } from "@/api/lib/route";
import { buildContentPublicModule, createContentModel } from "@/content/server";
import { testPostContentType } from "@/tests/content-fixtures";

import { fetcher } from "./index";

const PLUGIN_ID = "@acme/notes";

const listNotesRoute = buildRoute({
  pluginId: PLUGIN_ID,
  route: {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ notes: z.array(z.string()) }),
          },
        },
        description: "Every note",
      },
    },
  },
  handler: c => c.json({ notes: [] }, 200),
});

const pinNoteRoute = buildRoute({
  pluginId: PLUGIN_ID,
  route: {
    method: "post",
    path: "/{id}/pin",
    request: {
      body: {
        content: {
          "application/json": { schema: z.object({ pinned: z.boolean() }) },
        },
      },
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ id: z.string() }) },
        },
        description: "The pinned note",
      },
      404: { description: "No such note" },
    },
  },
  handler: c => c.json({ id: "1" }, 200),
});

const listColorsRoute = buildRoute({
  pluginId: PLUGIN_ID,
  route: {
    method: "get",
    path: "/",
    request: { query: z.object({ search: z.string().optional() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ colors: z.array(z.string()) }),
          },
        },
        description: "Tag colors",
      },
    },
  },
  handler: c => c.json({ colors: [] }, 200),
});

const colorsModule = buildModule({
  pluginId: PLUGIN_ID,
  name: "colors",
  routes: [listColorsRoute],
});

const tagsModule = buildModule({
  pluginId: PLUGIN_ID,
  name: "tags",
  routes: [],
  modules: [colorsModule],
});

const notesModule = buildModule({
  pluginId: PLUGIN_ID,
  name: "notes",
  routes: [listNotesRoute, pinNoteRoute],
  modules: [tagsModule],
});

const postContent = createContentModel(testPostContentType);

const notesApiPlugin = () =>
  buildApiPlugin({
    pluginId: PLUGIN_ID,
    modules: [
      notesModule,
      buildContentPublicModule({
        pluginId: PLUGIN_ID,
        contentTypes: [postContent],
      }),
    ],
  });

type NotesApiPlugin = ApiPluginContract<ReturnType<typeof notesApiPlugin>>;

declare module "../../lib/fetcher/registry" {
  interface ApiPluginRegistry {
    "@acme/notes": NotesApiPlugin;
  }
}

describe("the plugin API keeps its literal shape", () => {
  it("retains the plugin id and the module tuple", () => {
    const plugin = notesApiPlugin();

    expectTypeOf(plugin.pluginId).toEqualTypeOf<"@acme/notes">();
    expectTypeOf(plugin.modules[0]).toEqualTypeOf<typeof notesModule>();
    expectTypeOf(plugin.modules).toHaveProperty("length");
    expectTypeOf(plugin.modules.length).toEqualTypeOf<2>();
  });
});

describe("the contract carries the API surface and nothing else", () => {
  it("keeps the literal plugin id", () => {
    expectTypeOf<NotesApiPlugin["pluginId"]>().toEqualTypeOf<"@acme/notes">();
  });

  it("flattens every module path, at every depth", () => {
    expectTypeOf<NotesApiPlugin["modulePaths"]>().toEqualTypeOf<
      "content" | "content/posts" | "notes" | "notes/tags" | "notes/tags/colors"
    >();
  });

  it("correlates plugin, module, path and method on every endpoint", () => {
    type Colors = Extract<
      NotesApiPlugin["endpoints"],
      { module: "notes/tags/colors" }
    >;

    expectTypeOf<Colors["plugin"]>().toEqualTypeOf<"@acme/notes">();
    expectTypeOf<Colors["path"]>().toEqualTypeOf<"/">();
    expectTypeOf<Colors["method"]>().toEqualTypeOf<"get">();
  });

  it("exposes no runtime member of the plugin it was built from", () => {
    type Members = keyof NotesApiPlugin;

    expectTypeOf<Members>().toEqualTypeOf<
      "endpoints" | "modulePaths" | "modules" | "pluginId"
    >();
  });
});

describe("the universal fetcher resolves a route from the plugin id", () => {
  it("infers the status and the body of a top-level core module", async () => {
    const response = await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf((await response.json()).user).not.toBeAny();
  });

  it("infers a registered plugin's own module", async () => {
    const response = await fetcher({
      plugin: "@acme/notes",
      method: "get",
      module: "notes",
      path: "/",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf((await response.json()).notes).toEqualTypeOf<string[]>();
  });

  it("walks nested modules to any depth", async () => {
    const core = await fetcher({
      plugin: "@vitnode/core",
      args: { query: {} },
      method: "get",
      module: "admin/advanced/cron",
      path: "/",
    });

    expectTypeOf(core.status).toEqualTypeOf<200>();

    const colors = await fetcher({
      plugin: "@acme/notes",
      args: { query: { search: "red" } },
      method: "get",
      module: "notes/tags/colors",
      path: "/",
    });

    expectTypeOf(colors.status).toEqualTypeOf<200>();
    expectTypeOf((await colors.json()).colors).toEqualTypeOf<string[]>();
  });

  it("types the routes a content type's public API generates", async () => {
    const list = await fetcher({
      plugin: "@acme/notes",
      args: { query: { first: "10", orderBy: "title" } },
      method: "get",
      module: "content/posts",
      path: "/",
    });

    expectTypeOf(list.status).toEqualTypeOf<200 | 400>();

    const detail = await fetcher({
      plugin: "@acme/notes",
      args: { params: { slug: "hello" } },
      method: "get",
      module: "content/posts",
      path: "/{slug}",
    });

    expectTypeOf(detail.status).toEqualTypeOf<200 | 404>();
  });

  it("keeps a status-aware union when a route declares several answers", async () => {
    const response = await fetcher({
      plugin: "@acme/notes",
      args: { body: { pinned: true }, params: { id: "1" } },
      method: "post",
      module: "notes",
      path: "/{id}/pin",
    });

    expectTypeOf(response.status).toEqualTypeOf<200 | 404>();

    if (response.status === 200) {
      expectTypeOf((await response.json()).id).toEqualTypeOf<string>();
    }
  });
});

describe("the universal fetcher rejects what the registry does not describe", () => {
  it("rejects a plugin that is not configured", async () => {
    await fetcher({
      // @ts-expect-error -- not in the registry
      plugin: "@acme/missing",
      method: "get",
      module: "notes",
      path: "/",
    });
  });

  it("rejects a module the plugin does not mount", async () => {
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      // @ts-expect-error -- not a module of `@acme/notes`
      module: "does-not-exist",
      path: "/",
    });
  });

  it("rejects a nested module path that skips a level", async () => {
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      // @ts-expect-error -- `colors` is under `tags`
      module: "notes/colors",
      path: "/",
    });
  });

  it("reports the field that is wrong, and only that field", async () => {
    // A module nobody serves has no paths and no methods either, so the two
    // fields that depend on it stay the caller's own rather than becoming
    // `never` and burying the one mistake under three errors.
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      // @ts-expect-error -- not a module of `@acme/notes`
      module: "does-not-exist",
      path: "/anything",
    });
  });

  it("rejects a path the module does not serve", async () => {
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      module: "notes",
      // @ts-expect-error -- not a route on `notes`
      path: "/not-a-route",
    });
  });

  it("rejects a method the route does not answer", async () => {
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- the public list is a `get`
      method: "delete",
      module: "content/posts",
      path: "/",
    });

    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `/{id}/pin` is a `post`
      method: "get",
      module: "notes",
      path: "/{id}/pin",
    });
  });

  it("rejects a call that omits required arguments", async () => {
    // @ts-expect-error -- `/{id}/pin` declares params and a body
    await fetcher({
      plugin: "@acme/notes",
      method: "post",
      module: "notes",
      path: "/{id}/pin",
    });

    // @ts-expect-error -- `/{slug}` declares params
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      module: "content/posts",
      path: "/{slug}",
    });
  });

  it("rejects arguments outside the route's schema", async () => {
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `pinned` is a boolean
      args: { body: { pinned: "yes" }, params: { id: "1" } },
      method: "post",
      module: "notes",
      path: "/{id}/pin",
    });

    await fetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- `nickname` is not on the sign-in schema
      args: { body: { email: "a@b.c", nickname: "x", password: "y" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects arguments on a route that declares none", async () => {
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `/` takes no body, params or query
      args: { query: { search: "x" } },
      method: "get",
      module: "notes",
      path: "/",
    });
  });
});

describe("the universal fetcher offers only what both runtimes can honour", () => {
  it("rejects the cookie relay, which is the server transport's", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- `allowSaveCookies` is on `tanstack/fetcher/server`
      allowSaveCookies: true,
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects forwarded headers", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- a browser cannot forge request headers
      additionalHeaders: { Cookie: "vitnode_auth=stolen" },
      method: "get",
      module: "users",
      path: "/session",
    });
  });

  it("rejects an origin override", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      // @ts-expect-error -- the browser calls its own origin
      origin: "https://api.example.com",
      path: "/session",
    });
  });

  it("still accepts the options both runtimes share", async () => {
    const controller = new AbortController();

    await fetcher({
      plugin: "@vitnode/core",
      captchaToken: "solved",
      method: "get",
      module: "users",
      options: { signal: controller.signal },
      path: "/session",
    });
  });
});
