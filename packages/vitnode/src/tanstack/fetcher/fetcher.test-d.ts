import { z } from "@hono/zod-openapi";
import { describe, expectTypeOf, it } from "vitest";

import type { ApiPluginContract } from "@/lib/fetcher/contract";

import { buildModule } from "@/api/lib/module";
import { buildApiPlugin } from "@/api/lib/plugin";
import { buildRoute } from "@/api/lib/route";
import { buildContentPublicModule, createContentModel } from "@/content/server";
import {
  testPostContentType,
  testTopicContentType,
} from "@/tests/content-fixtures";
import { testManifest } from "@/tests/manifest";

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
const topicContent = createContentModel(testTopicContentType);

const notesApiPlugin = () =>
  buildApiPlugin({
    manifest: testManifest(PLUGIN_ID),
    modules: [
      notesModule,
      buildContentPublicModule({
        pluginId: PLUGIN_ID,
        contentTypes: [postContent, topicContent],
      }),
    ],
  });

type NotesApiPlugin = ApiPluginContract<ReturnType<typeof notesApiPlugin>>;

declare module "../../lib/fetcher/registry" {
  interface ApiPluginRegistry {
    "@acme/notes": NotesApiPlugin;
  }
}

describe("the plugin contract", () => {
  it("keeps the literal plugin id and flattens every module path", () => {
    expectTypeOf<NotesApiPlugin["pluginId"]>().toEqualTypeOf<"@acme/notes">();
    expectTypeOf<NotesApiPlugin["modulePaths"]>().toEqualTypeOf<
      | "content"
      | "content/posts"
      | "content/topics"
      | "notes"
      | "notes/tags"
      | "notes/tags/colors"
    >();
  });
});

describe("the universal fetcher resolves a route from the plugin id", () => {
  it("infers the status and the body of a core module", async () => {
    const response = await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf((await response.json()).user).not.toBeAny();
  });

  it("walks a registered plugin's nested modules to any depth", async () => {
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

  it("types the routes a content type's public API generates", async () => {
    const list = await fetcher({
      plugin: "@acme/notes",
      args: { query: { first: "10", orderBy: "title" } },
      method: "get",
      module: "content/posts",
      path: "/",
    });
    const detail = await fetcher({
      plugin: "@acme/notes",
      args: { params: { slug: "hello" }, query: { locale: "pl" } },
      method: "get",
      module: "content/posts",
      path: "/{slug}",
    });

    expectTypeOf(list.status).toEqualTypeOf<200 | 400 | 404>();
    expectTypeOf(detail.status).toEqualTypeOf<200 | 404>();
  });

  it("types the routes a content type's publicWrite generates", async () => {
    const created = await fetcher({
      plugin: "@acme/notes",
      args: {
        body: {
          values: { body: { type: "doc" }, forum: 1, title: "Hello" },
        },
      },
      method: "post",
      module: "content/topics",
      path: "/",
    });

    expectTypeOf(created.status).toEqualTypeOf<201 | 400 | 401 | 409>();
    if (created.status === 201) {
      expectTypeOf((await created.json()).values.title).toEqualTypeOf<string>();
    }

    const updated = await fetcher({
      plugin: "@acme/notes",
      args: { body: { values: { title: "Renamed" } }, params: { id: 1 } },
      method: "patch",
      module: "content/topics",
      path: "/{id}",
    });

    expectTypeOf(updated.status).toEqualTypeOf<
      200 | 400 | 401 | 403 | 404 | 409
    >();
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

  it("reports only the module when the plugin does not mount it", async () => {
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      // @ts-expect-error -- not a module of `@acme/notes`
      module: "does-not-exist",
      path: "/anything",
    });
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      // @ts-expect-error -- `colors` is under `tags`
      module: "notes/colors",
      path: "/",
    });
  });

  it("rejects a path or a method the module does not serve", async () => {
    await fetcher({
      plugin: "@acme/notes",
      method: "get",
      module: "notes",
      // @ts-expect-error -- not a route on `notes`
      path: "/not-a-route",
    });
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `/{id}/pin` is a `post`
      method: "get",
      module: "notes",
      path: "/{id}/pin",
    });
  });

  it("rejects missing, mistyped and undeclared arguments", async () => {
    // @ts-expect-error -- `/{id}/pin` declares params and a body
    await fetcher({
      plugin: "@acme/notes",
      method: "post",
      module: "notes",
      path: "/{id}/pin",
    });
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
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `/` takes no body, params or query
      args: { query: { search: "x" } },
      method: "get",
      module: "notes",
      path: "/",
    });
  });

  it("rejects a write the content type does not allow", async () => {
    await fetcher({
      plugin: "@acme/notes",
      // @ts-expect-error -- `content/posts` has a read-only public API
      method: "post",
      module: "content/posts",
      path: "/",
    });
    await fetcher({
      plugin: "@acme/notes",
      args: {
        body: {
          values: {
            // @ts-expect-error -- the owner is stamped by the server
            author: 2,
            body: { type: "doc" },
            forum: 1,
            title: "Hello",
          },
        },
      },
      method: "post",
      module: "content/topics",
      path: "/",
    });
  });
});

describe("the universal fetcher offers only what both runtimes can honour", () => {
  it("rejects server-only options", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- `allowSaveCookies` is on `tanstack/fetcher/server`
      allowSaveCookies: true,
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
    await fetcher({
      plugin: "@vitnode/core",
      // @ts-expect-error -- a browser cannot forge request headers
      additionalHeaders: { Cookie: "vitnode_auth=stolen" },
      method: "get",
      module: "users",
      path: "/session",
    });
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
    await fetcher({
      plugin: "@vitnode/core",
      captchaToken: "solved",
      method: "get",
      module: "users",
      options: { signal: new AbortController().signal },
      path: "/session",
    });
  });
});
