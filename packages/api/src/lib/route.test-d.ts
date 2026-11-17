import { z } from "@hono/zod-openapi";
import { describe, expectTypeOf, it } from "vitest";

import { buildRoute } from "./route";

const created = {
  201: {
    content: {
      "application/json": { schema: z.object({ id: z.number() }) },
    },
    description: "Created",
  },
} as const;

const body = {
  content: {
    "application/json": { schema: z.object({ title: z.string() }) },
  },
} as const;

describe("buildRoute mcp", () => {
  it("accepts true, false, omitted and options without changing the handler's types", () => {
    for (const mcp of [
      true,
      false,
      undefined,
      {
        annotations: { readOnlyHint: false, title: "Create" },
        description: "Create a note",
        name: "create_note",
      },
    ]) {
      buildRoute({
        pluginId: "@acme/notes",
        route: {
          method: "post",
          path: "/{id}",
          mcp,
          request: { body, params: z.object({ id: z.string() }) },
          responses: created,
        },
        handler: c => {
          expectTypeOf(c.req.valid("json")).toEqualTypeOf<{ title: string }>();
          expectTypeOf(c.req.valid("param")).toEqualTypeOf<{ id: string }>();

          return c.json({ id: 1 }, 201);
        },
      });
    }
  });

  it("rejects anything else", () => {
    buildRoute({
      pluginId: "@acme/notes",
      route: {
        method: "get",
        path: "/",
        // @ts-expect-error -- not a boolean or options
        mcp: "yes",
        responses: created,
      },
      handler: c => c.json({ id: 1 }, 201),
    });
    buildRoute({
      pluginId: "@acme/notes",
      route: {
        method: "get",
        path: "/",
        // @ts-expect-error -- not an MCP option
        mcp: { scopes: ["x"] },
        responses: created,
      },
      handler: c => c.json({ id: 1 }, 201),
    });
  });
});
