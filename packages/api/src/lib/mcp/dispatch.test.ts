import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { McpDispatchFrame } from "./dispatch";
import type { McpToolDescriptor } from "./registry";

import { dispatchMcpTool, McpArgumentsError, toolResultOf } from "./dispatch";

const FRAME: McpDispatchFrame = {
  correlationId: "corr-1",
  ipAddress: "198.51.100.4",
  principal: { tokenId: 1, userId: 7 },
  tool: "acme-notes__tool",
};

const tool = (
  overrides: Partial<McpToolDescriptor> = {},
): McpToolDescriptor => ({
  description: "A tool",
  groups: {},
  inputSchema: { type: "object" },
  method: "GET",
  name: "acme-notes__tool",
  operation: "tool",
  path: "/notes",
  pluginId: "@acme/notes",
  requiresAdmin: false,
  ...overrides,
});

const NOTE_TOOL = tool({
  groups: {
    body: { names: ["title", "summary"], required: false },
    params: { names: ["id"], required: true },
    query: { names: ["locale"], required: false },
  },
  method: "PUT",
  path: "/notes/{id}",
});

/** An outer MCP request carrying a session cookie and a bearer token. */
const outer = {
  env: undefined,
  get executionCtx(): never {
    throw new Error("no execution context");
  },
  req: {
    header: (name: string) =>
      ({
        authorization: "Bearer vnmcp_secret",
        cookie: "vitnode_auth=session",
        "user-agent": "mcp-client/1.0",
      })[name.toLowerCase()],
    url: "https://api.test/api/mcp",
  },
} as unknown as Context;

/** Dispatches `args` and returns the request the route would have received. */
const dispatched = async (
  args: unknown,
  descriptor: McpToolDescriptor = NOTE_TOOL,
): Promise<{ body: null | string; request: Request }> => {
  let seen: Request | undefined;
  await dispatchMcpTool(
    {
      basePath: "/api",
      c: outer,
      fetch: request => {
        seen = request;

        return Response.json({ ok: true });
      },
      maxResponseBytes: 1024,
    },
    { args, frame: FRAME, tool: descriptor },
  );
  if (!seen) throw new Error("not dispatched");

  return { body: seen.body ? await seen.text() : null, request: seen };
};

describe("dispatchMcpTool", () => {
  it("maps params into the path, query into the search and body into JSON", async () => {
    const { body, request } = await dispatched({
      body: { title: "Hi" },
      params: { id: 5 },
      query: { draft: true, locale: "pl", skipped: undefined },
    });

    expect(request.method).toBe("PUT");
    expect(request.url).toBe(
      "https://api.test/api/@acme/notes/notes/5?draft=true&locale=pl",
    );
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(body).toBe('{"title":"Hi"}');
  });

  it.each([
    ["a space and a slash", "a b/c", "/api/@acme/notes/notes/a%20b%2Fc"],
    ["a question mark", "x?y=1", "/api/@acme/notes/notes/x%3Fy%3D1"],
  ])("encodes %s inside a path parameter", async (_label, id, pathname) => {
    const { request } = await dispatched({ params: { id } });

    expect(new URL(request.url).pathname).toBe(pathname);
    expect(new URL(request.url).search).toBe("");
  });

  it.each([
    ["an omitted key stays omitted", { title: "Hi" }, '{"title":"Hi"}'],
    ["null stays null", { summary: null }, '{"summary":null}'],
  ])("sends the body verbatim: %s", async (_label, input, sent) => {
    const { body } = await dispatched({ body: input, params: { id: 1 } });

    expect(body).toBe(sent);
  });

  it("sends no body when the call leaves it out", async () => {
    const { body, request } = await dispatched({ params: { id: 1 } });

    expect(body).toBeNull();
    expect(request.headers.has("content-type")).toBe(false);
  });

  it("carries no credential of the outer request", async () => {
    const { request } = await dispatched({ params: { id: 1 } });

    expect(request.headers.has("cookie")).toBe(false);
    expect(request.headers.has("authorization")).toBe(false);
    expect(request.headers.get("user-agent")).toBe("mcp-client/1.0");
  });

  it.each<[string, unknown, RegExp]>([
    ["arguments that are not an object", ["x"], /must be an object/],
    [
      "an unknown group",
      { params: { id: 1 }, headers: {} },
      /Unknown argument "headers"/,
    ],
    ["a missing required group", {}, /"params" is required/],
    ["an empty path parameter", { params: { id: "" } }, /non-empty string/],
    [
      "an object path parameter",
      { params: { id: { a: 1 } } },
      /non-empty string/,
    ],
    ["a `.` path parameter", { params: { id: "." } }, /cannot be "\."/],
    ["a `..` path parameter", { params: { id: ".." } }, /cannot be "\.\."/],
    [
      "an array query value",
      { params: { id: 1 }, query: { locale: ["pl"] } },
      /"query.locale" must be a string/,
    ],
  ])("refuses %s before reaching the route", async (_label, args, message) => {
    let reached = false;
    const call = dispatchMcpTool(
      {
        basePath: "/api",
        c: outer,
        fetch: () => {
          reached = true;

          return Response.json({});
        },
        maxResponseBytes: 1024,
      },
      { args, frame: FRAME, tool: NOTE_TOOL },
    );

    await expect(call).rejects.toThrow(McpArgumentsError);
    await expect(call).rejects.toThrow(message);
    expect(reached).toBe(false);
  });

  it("refuses any argument for a tool that takes none", async () => {
    await expect(dispatched({ query: {} }, tool())).rejects.toThrow(
      /takes no arguments/,
    );
  });
});

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });

const text = (body: string, status: number, type = "text/plain") =>
  new Response(body, { headers: { "content-type": type }, status });

describe("toolResultOf", () => {
  it.each<[string, Response, unknown]>([
    [
      "an object as structured content",
      json({ id: 1 }),
      {
        content: [{ text: '{"id":1}', type: "text" }],
        structuredContent: { id: 1 },
      },
    ],
    [
      "an array wrapped in result",
      json([1, 2]),
      {
        content: [{ text: "[1,2]", type: "text" }],
        structuredContent: { result: [1, 2] },
      },
    ],
    [
      "a scalar wrapped in result",
      json("done"),
      {
        content: [{ text: '"done"', type: "text" }],
        structuredContent: { result: "done" },
      },
    ],
    [
      "a vendor JSON type",
      json({ a: 1 }, 200, { "content-type": "application/problem+json" }),
      {
        content: [{ text: '{"a":1}', type: "text" }],
        structuredContent: { a: 1 },
      },
    ],
    [
      "an empty 204 as done",
      new Response(null, { status: 204 }),
      { content: [{ text: "Done (HTTP 204).", type: "text" }] },
    ],
    [
      "a redirect as an error it does not follow",
      new Response(null, { headers: { location: "/x" }, status: 302 }),
      {
        content: [
          {
            text: "The route answered with a redirect (HTTP 302), which MCP tools do not follow.",
            type: "text",
          },
        ],
        isError: true,
      },
    ],
    [
      "a JSON 4xx with its body",
      json({ error: "not_found" }, 404),
      {
        content: [
          {
            text: 'The call failed with HTTP 404: {"error":"not_found"}',
            type: "text",
          },
        ],
        isError: true,
      },
    ],
    [
      "a text 4xx with its body",
      text("Forbidden ", 403),
      {
        content: [
          { text: "The call failed with HTTP 403: Forbidden", type: "text" },
        ],
        isError: true,
      },
    ],
    [
      "a 5xx without its body",
      text("Error: at db.ts:12 password=hunter2", 500),
      {
        content: [
          {
            text: "The call failed with HTTP 500: Internal Server Error.",
            type: "text",
          },
        ],
        isError: true,
      },
    ],
    [
      "malformed JSON as an error",
      text("{nope", 200, "application/json"),
      {
        content: [
          {
            text: "The route returned malformed JSON (HTTP 200).",
            type: "text",
          },
        ],
        isError: true,
      },
    ],
    [
      "a non-JSON success as an error",
      text("<p>hi</p>", 200, "text/html"),
      {
        content: [
          {
            text: "The route returned text/html; MCP tools return JSON only.",
            type: "text",
          },
        ],
        isError: true,
      },
    ],
  ])("turns %s", async (_label, response, result) => {
    expect(await toolResultOf(response, 1024)).toEqual(result);
  });

  it("refuses a body over the limit instead of cutting it", async () => {
    const result = await toolResultOf(json({ big: "x".repeat(100) }), 64);

    expect(result).toEqual({
      content: [
        {
          text: "The response is larger than 64 bytes, the limit for one tool result. Narrow the request - a smaller page, fewer fields.",
          type: "text",
        },
      ],
      isError: true,
    });
  });

  it("never reads a response header into the result", async () => {
    const result = await toolResultOf(
      json({ ok: true }, 200, {
        "set-cookie": "vitnode_auth=secret",
        "x-internal": "secret",
      }),
      1024,
    );

    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
