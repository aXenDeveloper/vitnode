import { z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { BuildRouteConfig } from "../route";

import { buildModule } from "../module";
import { buildRoute } from "../route";
import {
  buildMcpRegistry,
  collectPluginMcpTools,
  mcpPluginPrefix,
} from "./registry";

const PLUGIN = "@acme/notes";

const okResponse = {
  200: {
    content: {
      "application/json": { schema: z.object({ ok: z.boolean() }) },
    },
    description: "ok",
  },
} as const;

type RouteInput = Partial<BuildRouteConfig<string>>;

const route = (config: RouteInput = {}) =>
  buildRoute({
    pluginId: PLUGIN,
    route: {
      method: "get",
      path: "/",
      summary: "Do something",
      responses: okResponse,
      mcp: true,
      ...config,
    },
    handler: c => c.json({ ok: true }, 200),
  });

const collect = (
  routes: ReturnType<typeof route>[],
  { name = "notes", pluginId = PLUGIN } = {},
) =>
  collectPluginMcpTools({
    modules: [buildModule({ pluginId, name, routes })],
    pluginId,
  });

const collectOne = (config: RouteInput) => {
  const [tool] = collect([route(config)]);

  return tool;
};

describe("collectPluginMcpTools", () => {
  it("collects only routes that opt in", () => {
    const tools = collect([
      route({ mcp: undefined, path: "/omitted" }),
      route({ mcp: false, path: "/off" }),
      route({ mcp: true, path: "/on" }),
      route({ mcp: { description: "Options" }, path: "/options" }),
    ]);

    expect(tools.map(tool => tool.path)).toEqual([
      "/notes/on",
      "/notes/options",
    ]);
  });

  it("walks nested modules and names the tool after the full path", () => {
    const tools = collectPluginMcpTools({
      pluginId: PLUGIN,
      modules: [
        buildModule({
          pluginId: PLUGIN,
          name: "admin",
          routes: [],
          modules: [
            buildModule({
              pluginId: PLUGIN,
              name: "notes",
              routes: [
                route({
                  path: "/{id}",
                  request: { params: z.object({ id: z.string() }) },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    expect(tools).toMatchObject([
      {
        name: "acme-notes__get_admin_notes_by_id",
        operation: "get_admin_notes_by_id",
        path: "/admin/notes/{id}",
        pluginId: PLUGIN,
        requiresAdmin: true,
      },
    ]);
  });

  it.each([
    ["the derived name", {}, "acme-notes__get_notes"],
    [
      "operationId over the derived name",
      { operationId: "listNotes" },
      "acme-notes__listNotes",
    ],
    [
      "mcp.name over operationId",
      { mcp: { name: "notes_list" }, operationId: "listNotes" },
      "acme-notes__notes_list",
    ],
  ])("uses %s", (_label, config, name) => {
    expect(collectOne(config).name).toBe(name);
  });

  it.each([
    ["@vitnode/blog", "vitnode-blog"],
    ["@acme/blog.tools", "acme-blog-tools"],
    ["plain", "plain"],
  ])("prefixes %s tools with %s", (pluginId, prefix) => {
    expect(mcpPluginPrefix(pluginId)).toBe(prefix);
  });

  it("names both routes when two share a tool name", () => {
    expect(() =>
      collect([
        route({ mcp: { name: "same" } }),
        route({ method: "post", mcp: { name: "same" } }),
      ]),
    ).toThrow(
      /GET \/notes in "@acme\/notes" and POST \/notes in "@acme\/notes"/,
    );
  });

  it.each<[string, RouteInput, RegExp]>([
    ["no description", { summary: undefined }, /no description/],
    ["a captcha", { withCaptcha: true }, /captcha/],
    [
      "request headers",
      { request: { headers: z.object({ "x-a": z.string() }) } },
      /headers or cookies/,
    ],
    [
      "request cookies",
      { request: { cookies: z.object({ a: z.string() }) } },
      /headers or cookies/,
    ],
    [
      "a multipart body",
      {
        method: "post",
        request: {
          body: {
            content: {
              "multipart/form-data": { schema: z.object({ file: z.string() }) },
            },
          },
        },
      },
      /Only a single application\/json body/,
    ],
    [
      "a non-JSON success response",
      {
        responses: {
          200: {
            content: { "text/html": { schema: z.string() } },
            description: "html",
          },
        },
      },
      /JSON only/,
    ],
    [
      "an array query parameter",
      { request: { query: z.object({ tags: z.array(z.string()) }) } },
      /query parameter "tags"/,
    ],
    [
      "an object query parameter",
      { request: { query: z.object({ filter: z.object({ a: z.string() }) }) } },
      /query parameter "filter"/,
    ],
    [
      "z.custom in the body",
      {
        method: "post",
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({ file: z.custom<File>() }),
              },
            },
          },
        },
      },
      /has no JSON Schema form/,
    ],
    [
      "a path parameter without a schema",
      { path: "/{id}" },
      /path parameters id have no schema/,
    ],
    [
      "characters outside the name alphabet",
      { mcp: { name: "a.b" } },
      /may only use/,
    ],
    [
      "a name over 128 characters",
      { mcp: { name: "x".repeat(120) } },
      /longer than 128 characters/,
    ],
  ])("refuses a route with %s at startup", (_label, config, message) => {
    expect(() => collectOne(config)).toThrow(message);
  });

  it("sorts tools by name whatever the declaration order", () => {
    const tools = collect([
      route({ mcp: { name: "zeta" } }),
      route({ mcp: { name: "alpha" }, path: "/a" }),
      route({ mcp: { name: "mid" }, path: "/m" }),
    ]);

    expect(tools.map(tool => tool.operation)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("groups arguments into params, query and body, each required only when it must be", () => {
    const tool = collectOne({
      method: "put",
      path: "/{id}",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({ title: z.string().optional() }),
            },
          },
        },
        params: z.object({ id: z.string() }),
        query: z.object({ locale: z.string().optional() }),
      },
    });

    expect(tool.groups).toEqual({
      body: { names: ["title"], required: false },
      params: { names: ["id"], required: true },
      query: { names: ["locale"], required: false },
    });
    expect(tool.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ["params"],
    });
  });

  it.each<[string, RouteInput["responses"], unknown]>([
    [
      "an object response as it is",
      okResponse,
      { properties: { ok: { type: "boolean" } }, type: "object" },
    ],
    [
      "an array response wrapped in result",
      {
        200: {
          content: { "application/json": { schema: z.array(z.string()) } },
          description: "list",
        },
      },
      {
        properties: { result: { items: { type: "string" }, type: "array" } },
        required: ["result"],
        type: "object",
      },
    ],
  ])("describes %s", (_label, responses, outputSchema) => {
    expect(collectOne({ responses }).outputSchema).toMatchObject(
      outputSchema as object,
    );
  });

  it.each<[string, RouteInput["responses"]]>([
    [
      "two success responses",
      {
        ...okResponse,
        201: {
          content: {
            "application/json": { schema: z.object({ id: z.number() }) },
          },
          description: "created",
        },
      },
    ],
    ["a success response without a body", { 204: { description: "done" } }],
  ])("has no outputSchema for %s", (_label, responses) => {
    expect(collectOne({ responses }).outputSchema).toBeUndefined();
  });
});

describe("buildMcpRegistry", () => {
  it("joins every plugin's tools sorted by name, and lists the plugins that have any", () => {
    const blog = collect([route({ mcp: { name: "list" } })], {
      pluginId: "@acme/blog",
    });
    const notes = collect([route({ mcp: { name: "list" } })]);

    const registry = buildMcpRegistry([
      { mcpTools: notes, pluginId: PLUGIN },
      { mcpTools: blog, pluginId: "@acme/blog" },
      { mcpTools: [], pluginId: "@acme/empty" },
    ]);

    expect(registry.tools.map(tool => tool.name)).toEqual([
      "acme-blog__list",
      "acme-notes__list",
    ]);
    expect(registry.pluginIds).toEqual(["@acme/blog", PLUGIN]);
    expect(registry.byName.get("acme-notes__list")?.pluginId).toBe(PLUGIN);
  });

  it("refuses two plugins whose ids map to one prefix", () => {
    expect(() =>
      buildMcpRegistry([
        { mcpTools: [], pluginId: "@acme/blog" },
        { mcpTools: [], pluginId: "acme-blog" },
      ]),
    ).toThrow(/"@acme\/blog" and "acme-blog" both name their MCP tools/);
  });
});
