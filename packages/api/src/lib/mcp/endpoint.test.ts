import { describe, expect, it } from "vitest";

import {
  createMcpWorld,
  MCP_USER,
  mcpCall,
  mcpRequest,
  mcpTokenFor,
  NOTES_PLUGIN,
  NOTES_VIEW,
  TOOL,
} from "@/tests/mcp-world";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import type { McpToolDescriptor } from "./registry";

const ALL_TOOLS = Object.values(TOOL);

const worldWith = async (
  tokens: { id: number; tools?: string[]; userId: number }[],
  options: Parameters<typeof createMcpWorld>[0] = {},
) =>
  await createMcpWorld({
    ...options,
    tokens: tokens.map(token => ({ tools: ALL_TOOLS, ...token })),
  });

const callTool = async (
  world: Awaited<ReturnType<typeof createMcpWorld>>,
  token: number,
  name: string,
  args: Record<string, unknown> = {},
  path?: string,
) =>
  await mcpCall(world, {
    method: "tools/call",
    params: { arguments: args, name },
    path,
    token: mcpTokenFor(token),
  });

const listNames = async (
  world: Awaited<ReturnType<typeof createMcpWorld>>,
  token: number,
  { cursor, path }: { cursor?: string; path?: string } = {},
) => {
  const { result } = await mcpCall(world, {
    method: "tools/list",
    params: cursor ? { cursor } : {},
    path,
    token: mcpTokenFor(token),
  });

  return {
    names: ((result?.tools ?? []) as { name: string }[]).map(tool => tool.name),
    nextCursor: result?.nextCursor as string | undefined,
  };
};

describe("a tool call", () => {
  it("runs the route's middleware, validation hook and handler once, as the token's owner", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.MEMBER }]);

    const { result } = await callTool(world, 1, TOOL.SHOW_NOTE, {
      params: { id: "n1" },
    });

    expect(result?.structuredContent).toMatchObject({
      id: "n1",
      userId: MCP_USER.MEMBER,
    });
    expect(world.calls).toEqual({ handler: 1, hook: 1, middleware: 1 });
  });

  it.each([
    ["an admin with the permission", MCP_USER.ADMIN, false, undefined],
    [
      "an admin without the permission",
      MCP_USER.ADMIN_NO_PERMISSION,
      false,
      403,
    ],
    ["a member", MCP_USER.MEMBER, false, 403],
    // The permission outlives the admin entry in the cache; only the live
    // admin check stops the call.
    [
      "a former admin whose permission is still cached",
      MCP_USER.MEMBER,
      true,
      403,
    ],
  ])(
    "on an /admin/ path runs for %s only when allowed",
    async (_label, userId, cachedGrant, failedWith) => {
      const world = await worldWith([{ id: 1, userId }]);
      if (cachedGrant) {
        await grantStaffPermissions(world.cache, {
          permissions: [NOTES_VIEW],
          userId,
        });
      }

      const { result } = await callTool(world, 1, TOOL.ADMIN_NOTES);

      if (failedWith) {
        expect(result).toMatchObject({ isError: true });
        expect(JSON.stringify(result)).toContain(`HTTP ${failedWith}`);
        expect(world.calls.handler).toBe(0);
      } else {
        expect(result?.structuredContent).toEqual({ adminId: userId });
      }
    },
  );

  it("cannot be forged: a bearer token sent straight to a route signs no one in", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.MEMBER }]);

    const response = await world.app.request(`/api/${NOTES_PLUGIN}/notes/n1`, {
      headers: { authorization: `Bearer ${mcpTokenFor(1)}` },
    });

    expect(await response.json()).toMatchObject({ userId: null });
  });

  it.each([
    ["success", { params: { id: "n1" } }, TOOL.SHOW_NOTE],
    ["error", {}, TOOL.ADMIN_NOTES],
    ["rejected_arguments", { nope: 1 }, TOOL.SHOW_NOTE],
  ])(
    "records the outcome %s in the audit log, never the arguments",
    async (outcome, args, name) => {
      const world = await worldWith([{ id: 3, userId: MCP_USER.MEMBER }]);

      await callTool(world, 3, name, args);

      expect(world.audit.record).toHaveBeenCalledWith(
        {
          action: "mcp.tool_called",
          metadata: {
            outcome,
            plugin: NOTES_PLUGIN,
            tokenId: 3,
            ...(outcome === "success" ? { targetId: "n1" } : {}),
          },
          pluginId: "@vitnode/core",
          target: { id: name, label: name, type: "mcp_tool" },
        },
        { bestEffort: true },
      );
    },
  );
});

describe("the MCP endpoint", () => {
  it.each<[string, Record<string, string>]>([
    ["no token", {}],
    ["a non-bearer scheme", { authorization: `Basic ${mcpTokenFor(1)}` }],
    ["an unknown token", { authorization: "Bearer vnmcp_unknown" }],
    ["an expired token", { authorization: `Bearer ${mcpTokenFor(2)}` }],
    ["a revoked token", { authorization: `Bearer ${mcpTokenFor(3)}` }],
  ])("answers 401 to %s", async (_label, headers) => {
    const world = await createMcpWorld({
      tokens: [
        { id: 1, tools: ALL_TOOLS, userId: MCP_USER.MEMBER },
        {
          expiresAt: new Date(Date.now() - 1000),
          id: 2,
          tools: ALL_TOOLS,
          userId: MCP_USER.MEMBER,
        },
        {
          id: 3,
          revokedAt: new Date(),
          tools: ALL_TOOLS,
          userId: MCP_USER.MEMBER,
        },
      ],
    });

    const response = await mcpRequest(world, {
      headers,
      method: "tools/list",
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="mcp"');
  });

  it("answers 403 when the token's owner is suspended", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.SUSPENDED }]);

    const response = await mcpRequest(world, {
      method: "tools/list",
      token: mcpTokenFor(1),
    });

    expect(response.status).toBe(403);
  });

  it.each([
    ["a foreign origin", "https://evil.test", 403],
    ["the API's own origin", "http://localhost", 200],
  ])("answers a browser from %s with %i", async (_label, origin, status) => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.MEMBER }]);

    const response = await mcpRequest(world, {
      headers: { origin },
      method: "tools/list",
      token: mcpTokenFor(1),
    });

    expect(response.status).toBe(status);
  });

  it("answers 404 for a plugin without tools", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.MEMBER }]);

    const response = await mcpRequest(world, {
      method: "tools/list",
      path: "/api/mcp/@acme/missing",
      token: mcpTokenFor(1),
    });

    expect(response.status).toBe(404);
  });

  it("answers 429 once the token spent its own rate limit", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.MEMBER }], {
      config: { rateLimit: { points: 1 } },
    });
    const list = async () =>
      await mcpRequest(world, { method: "tools/list", token: mcpTokenFor(1) });

    expect((await list()).status).toBe(200);
    expect((await list()).status).toBe(429);
  });

  it("serves only its plugin's tools on a per-plugin endpoint", async () => {
    const world = await worldWith([{ id: 1, userId: MCP_USER.ADMIN }]);
    const path = `/api/mcp/${NOTES_PLUGIN}`;

    expect((await listNames(world, 1, { path })).names).toEqual([
      TOOL.CREATE_NOTE,
      TOOL.ADMIN_NOTES,
      TOOL.SHOW_NOTE,
    ]);
    expect(await callTool(world, 1, TOOL.OTHER, {}, path)).toMatchObject({
      error: { code: -32602, message: `Unknown tool: ${TOOL.OTHER}` },
    });
  });

  it("answers a tool outside the token's grants like one that does not exist", async () => {
    const world = await worldWith([
      { id: 1, tools: [TOOL.SHOW_NOTE], userId: MCP_USER.MEMBER },
    ]);

    expect(await callTool(world, 1, TOOL.CREATE_NOTE)).toMatchObject({
      error: { code: -32602, message: `Unknown tool: ${TOOL.CREATE_NOTE}` },
    });
    expect(await callTool(world, 1, "acme-notes__nothing")).toMatchObject({
      error: { code: -32602, message: "Unknown tool: acme-notes__nothing" },
    });
    expect(world.calls.handler).toBe(0);
  });

  it.each([
    [
      "a member",
      MCP_USER.MEMBER,
      [TOOL.CREATE_NOTE, TOOL.SHOW_NOTE, TOOL.OTHER],
    ],
    [
      "an admin without the permission",
      MCP_USER.ADMIN_NO_PERMISSION,
      [TOOL.CREATE_NOTE, TOOL.SHOW_NOTE, TOOL.OTHER],
    ],
    [
      "an admin with the permission",
      MCP_USER.ADMIN,
      [TOOL.CREATE_NOTE, TOOL.ADMIN_NOTES, TOOL.SHOW_NOTE, TOOL.OTHER],
    ],
  ])(
    "lists to %s only the granted tools they may use",
    async (_label, userId, names) => {
      const world = await worldWith([{ id: 1, userId }]);

      expect((await listNames(world, 1)).names).toEqual(names);
    },
  );

  it("pages tools/list with nextCursor", async () => {
    const extraTools: McpToolDescriptor[] = Array.from(
      { length: 60 },
      (_, index) => ({
        description: "Extra",
        groups: {},
        inputSchema: { type: "object" },
        method: "GET",
        name: `acme-notes__extra_${String(index).padStart(2, "0")}`,
        operation: `extra_${index}`,
        path: `/extra/${index}`,
        pluginId: NOTES_PLUGIN,
        requiresAdmin: false,
      }),
    );
    const world = await worldWith(
      [
        {
          id: 1,
          tools: extraTools.map(tool => tool.name),
          userId: MCP_USER.MEMBER,
        },
      ],
      { extraTools },
    );

    const first = await listNames(world, 1);
    const second = await listNames(world, 1, { cursor: first.nextCursor });

    expect(first.names).toHaveLength(50);
    expect(first.nextCursor).toBeDefined();
    expect(second.names).toHaveLength(10);
    expect(second.nextCursor).toBeUndefined();
    expect([...first.names, ...second.names]).toEqual(
      extraTools.map(tool => tool.name),
    );
  });

  it("never mixes two principals' catalogs or identities under concurrency", async () => {
    const world = await worldWith([
      { id: 1, userId: MCP_USER.MEMBER },
      { id: 2, userId: MCP_USER.ADMIN },
    ]);

    const runs = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const token = (index % 2) + 1;
        const [list, call] = await Promise.all([
          listNames(world, token),
          callTool(world, token, TOOL.SHOW_NOTE, { params: { id: "n" } }),
        ]);

        return {
          admin: list.names.includes(TOOL.ADMIN_NOTES),
          token,
          userId: (
            call.result?.structuredContent as undefined | { userId?: number }
          )?.userId,
        };
      }),
    );

    for (const run of runs) {
      expect(run).toEqual(
        run.token === 1
          ? { admin: false, token: 1, userId: MCP_USER.MEMBER }
          : { admin: true, token: 2, userId: MCP_USER.ADMIN },
      );
    }
  });
});
