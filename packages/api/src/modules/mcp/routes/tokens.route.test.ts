import type { Context, Next } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { McpConfig } from "@/lib/mcp/config";
import type { McpToolDescriptor } from "@/lib/mcp/registry";
import type { EnvVariablesVitNode } from "@/middlewares/global.middleware";

import { core_mcp_tokens } from "@/database/mcp";
import { mcpTokenCreatedEvent, mcpTokenRevokedEvent } from "@/events/mcp";
import { resolveMcpConfig } from "@/lib/mcp/config";
import { buildMcpRegistry } from "@/lib/mcp/registry";
import { hashSessionToken } from "@/lib/session-token";
import {
  createSessionWorld,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";

import { createMcpTokenRoute } from "./create-token.route";
import { listMcpTokensRoute } from "./list-tokens.route";
import { revokeMcpTokenRoute } from "./revoke-token.route";

const LAPTOP = { id: 3, publicId: "laptop" };
const member = fakeSession(7, LAPTOP);
const someoneElse = fakeSession(8, LAPTOP);

const descriptor = (
  name: string,
  overrides: Partial<McpToolDescriptor> = {},
): McpToolDescriptor => ({
  description: name,
  groups: {},
  inputSchema: { type: "object" },
  method: "GET",
  name,
  operation: name,
  path: `/${name}`,
  pluginId: "@acme/notes",
  requiresAdmin: false,
  ...overrides,
});

const MEMBER_TOOL = "acme-notes__show";
const ADMIN_TOOL = "acme-notes__admin_list";

const registry = buildMcpRegistry([
  {
    mcpTools: [
      descriptor(MEMBER_TOOL),
      descriptor(ADMIN_TOOL, {
        requiresAdmin: true,
        staffPermissions: {
          admin: {
            module: "notes",
            permission: "can_view",
            plugin: "@acme/notes",
          },
        },
      }),
    ],
    pluginId: "@acme/notes",
  },
]);

const setup = async (config: McpConfig = { enabled: true }) => {
  const world = await createSessionWorld({
    extraTables: [
      [
        core_mcp_tokens,
        [
          {
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86_400_000),
            id: 100,
            label: "Someone else's",
            lastUsedAt: null,
            prefix: "vnmcp_other",
            revokedAt: null,
            tokenHash: "f".repeat(64),
            tools: [MEMBER_TOOL],
            userId: someoneElse.userId,
          },
        ],
      ],
    ],
    sessions: [member, someoneElse],
  });
  const audit = { record: vi.fn(async () => Promise.resolve(undefined)) };
  world.app.use("*", async (c: Context, next: Next) => {
    c.set("core", {
      ...c.get("core"),
      mcp: { config: resolveMcpConfig(config), registry },
    });
    c.set("audit", audit as unknown as EnvVariablesVitNode["audit"]);
    await next();
  });
  for (const route of [
    createMcpTokenRoute,
    listMcpTokensRoute,
    revokeMcpTokenRoute,
  ]) {
    world.app.openapi(route.route, route.handler);
  }

  const send = async (
    path: string,
    { body, method = "GET" }: { body?: unknown; method?: string } = {},
  ) =>
    await world.app.request(path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        cookie: sessionCookies(member, "user"),
      },
      method,
    });

  const create = async (body: Record<string, unknown> = {}) =>
    await send("/tokens", {
      body: {
        expiresInDays: 30,
        label: "Claude",
        tools: [MEMBER_TOOL],
        ...body,
      },
      method: "POST",
    });

  return { ...world, audit, create, send };
};

describe("creating an MCP token", () => {
  it("returns the token once and stores only its SHA-256", async () => {
    const { create, emit, audit, rows, send } = await setup();

    const response = await create();
    const { token, tokenInfo } = (await response.json()) as {
      token: string;
      tokenInfo: { id: number; status: string; tools: string[] };
    };

    expect(response.status).toBe(201);
    expect(token).toMatch(/^vnmcp_[\w-]{43}$/);
    expect(tokenInfo).toMatchObject({ status: "active", tools: [MEMBER_TOOL] });
    const stored = rows(core_mcp_tokens).find(row => row.id === tokenInfo.id);
    expect(stored?.tokenHash).toBe(await hashSessionToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(await (await send("/tokens")).text()).not.toContain(token);

    expect(emit).toHaveBeenCalledWith(mcpTokenCreatedEvent, {
      expiresAt: expect.any(String) as string,
      tokenId: tokenInfo.id,
      tools: [MEMBER_TOOL],
      userId: member.userId,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mcp.token_created" }),
    );
  });

  it.each<[string, McpConfig, Record<string, unknown>, number, unknown]>([
    [
      "a tool the member may not use",
      { enabled: true },
      { tools: [MEMBER_TOOL, ADMIN_TOOL, "acme-notes__missing"] },
      400,
      {
        error: "tools_not_available",
        tools: [ADMIN_TOOL, "acme-notes__missing"],
      },
    ],
    [
      "a lifetime over the cap",
      { enabled: true, tokenMaxLifetimeDays: 30 },
      { expiresInDays: 31 },
      400,
      { error: "token_lifetime_too_long" },
    ],
    ["MCP turned off", { enabled: false }, {}, 404, { error: "mcp_disabled" }],
  ])(
    "refuses %s and stores nothing",
    async (_label, config, body, status, error) => {
      const { create, emit, rows } = await setup(config);

      const response = await create(body);

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(error);
      expect(rows(core_mcp_tokens)).toHaveLength(1);
      expect(emit).not.toHaveBeenCalled();
    },
  );
});

describe("listing MCP tokens", () => {
  it("lists only the member's own tokens, without any hash", async () => {
    const { create, send } = await setup();
    await create({ label: "Mine" });

    const response = await send("/tokens");
    const { tokens } = (await response.json()) as {
      tokens: Record<string, unknown>[];
    };

    expect(tokens.map(token => token.label)).toEqual(["Mine"]);
    expect(tokens[0]).not.toHaveProperty("tokenHash");
  });
});

describe("revoking an MCP token", () => {
  it("revokes the member's own token and says so", async () => {
    const { audit, create, emit, send } = await setup();
    const { tokenInfo } = (await (await create()).json()) as {
      tokenInfo: { id: number };
    };

    const response = await send(`/tokens/${tokenInfo.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      tokenInfo: { id: tokenInfo.id, status: "revoked" },
    });
    expect(emit).toHaveBeenCalledWith(mcpTokenRevokedEvent, {
      tokenId: tokenInfo.id,
      userId: member.userId,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mcp.token_revoked" }),
    );
    expect(
      (await send(`/tokens/${tokenInfo.id}`, { method: "DELETE" })).status,
    ).toBe(404);
  });

  it("answers 404 for another member's token and leaves it live", async () => {
    const { rows, send } = await setup();

    const response = await send("/tokens/100", { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(rows(core_mcp_tokens)[0].revokedAt).toBeNull();
  });
});
