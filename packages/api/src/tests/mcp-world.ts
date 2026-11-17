import type { Context, Next } from "hono";

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { vi } from "vitest";

import type { McpConfig } from "@/lib/mcp/config";
import type { McpToolDescriptor } from "@/lib/mcp/registry";
import type { PermissionsStaffArgs } from "@/lib/permission-staff";
import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/middlewares/global.middleware";

import { core_admin_permissions } from "@/database/admins";
import { core_mcp_tokens } from "@/database/mcp";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { core_moderation_sanctions } from "@/database/warnings";
import { clientIpMiddleware } from "@/lib/client-ip";
import { resolveMcpConfig } from "@/lib/mcp/config";
import { mcpDispatchMiddleware, mcpDispatchOf } from "@/lib/mcp/dispatch";
import { createMcpEndpoints } from "@/lib/mcp/endpoint";
import { buildMcpRegistry, collectPluginMcpTools } from "@/lib/mcp/registry";
import { MCP_TOKEN_PREFIX } from "@/lib/mcp/tokens";
import { buildModule } from "@/lib/module";
import { buildRoute } from "@/lib/route";
import { hashSessionToken } from "@/lib/session-token";
import { defineStaffPermissions } from "@/lib/staff-permissions";
import { globalAdminMiddleware } from "@/middlewares/global.middleware";
import { SessionModel } from "@/models/session";
import { UserModel } from "@/models/user";

import { createTestCache } from "./cache";
import { createMemoryDb } from "./memory-db";
import { SESSION_AUTHORIZATION } from "./sessions";

const MEMBER_ROLE_ID = 3;

export const NOTES_PLUGIN = "@acme/notes" as const;
export const OTHER_PLUGIN = "@acme/other" as const;

export const MCP_USER = {
  /** Admin holding `notes.can_view`. */
  ADMIN: 1,
  /** Admin without any permission. */
  ADMIN_NO_PERMISSION: 2,
  MEMBER: 7,
  SUSPENDED: 9,
} as const;

export const TOOL = {
  ADMIN_NOTES: "acme-notes__get_admin_notes",
  CREATE_NOTE: "acme-notes__create_note",
  OTHER: "acme-other__get_other",
  SHOW_NOTE: "acme-notes__get_notes_by_id",
} as const;

export const NOTES_VIEW: PermissionsStaffArgs = {
  module: "notes",
  permission: "can_view",
  plugin: NOTES_PLUGIN,
};

const notesPermissions = defineStaffPermissions(
  { id: NOTES_PLUGIN },
  { admin: { notes: ["can_view"] } },
);

/** How often each stage of the counted routes ran, across the world. */
export interface McpWorldCalls {
  handler: number;
  hook: number;
  middleware: number;
}

const notesPlugin = (calls: McpWorldCalls) => {
  const counted = async (_c: Context, next: Next) => {
    calls.middleware++;
    await next();
  };

  const showNote = buildRoute({
    pluginId: NOTES_PLUGIN,
    route: {
      method: "get",
      path: "/{id}",
      summary: "Show a note",
      mcp: true,
      middleware: [counted],
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                id: z.string(),
                ipAddress: z.string(),
                userId: z.number().nullable(),
              }),
            },
          },
          description: "The note",
        },
      },
    },
    hook: (result, c) => {
      calls.hook++;
      if (!result.success) return c.json({ error: "invalid" }, 400);
    },
    handler: c => {
      calls.handler++;

      return c.json(
        {
          id: c.req.valid("param").id,
          ipAddress: c.get("ipAddress"),
          userId: c.get("user")?.id ?? null,
        },
        200,
      );
    },
  });

  const createNote = buildRoute({
    pluginId: NOTES_PLUGIN,
    route: {
      method: "post",
      path: "/",
      summary: "Create a note",
      mcp: { name: "create_note" },
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({ title: z.string().min(1) }),
            },
          },
          required: true,
        },
      },
      responses: {
        201: {
          content: {
            "application/json": {
              schema: z.object({ title: z.string(), userId: z.number() }),
            },
          },
          description: "Created",
        },
        401: { description: "Signed out" },
      },
    },
    handler: c => {
      const user = c.get("user");
      if (!user) return c.json({ error: "unauthorized" }, 401);

      return c.json({ title: c.req.valid("json").title, userId: user.id }, 201);
    },
  });

  const adminNotes = buildRoute({
    pluginId: NOTES_PLUGIN,
    adminStaffPermission: notesPermissions.admin.notes.canView,
    route: {
      method: "get",
      path: "/",
      summary: "List notes in the AdminCP",
      mcp: true,
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ adminId: z.number() }),
            },
          },
          description: "Notes",
        },
      },
    },
    handler: c => {
      calls.handler++;

      return c.json({ adminId: c.get("admin")?.user.id ?? -1 }, 200);
    },
  });

  const modules = [
    buildModule({
      pluginId: NOTES_PLUGIN,
      name: "notes",
      routes: [showNote, createNote],
    }),
    buildModule({
      pluginId: NOTES_PLUGIN,
      name: "admin",
      routes: [],
      modules: [
        buildModule({
          pluginId: NOTES_PLUGIN,
          name: "notes",
          routes: [adminNotes],
        }),
      ],
    }),
  ];

  return modules;
};

const otherPlugin = () => [
  buildModule({
    pluginId: OTHER_PLUGIN,
    name: "other",
    routes: [
      buildRoute({
        pluginId: OTHER_PLUGIN,
        route: {
          method: "get",
          path: "/",
          summary: "Other plugin's tool",
          mcp: true,
          responses: {
            200: {
              content: {
                "application/json": { schema: z.object({ ok: z.boolean() }) },
              },
              description: "ok",
            },
          },
        },
        handler: c => c.json({ ok: true }, 200),
      }),
    ],
  }),
];

export interface McpWorldToken {
  expiresAt?: Date;
  id: number;
  revokedAt?: Date;
  tools: string[];
  userId: number;
}

/** A raw token for a seeded row; deterministic, so tests can name it. */
export const mcpTokenFor = (id: number): string =>
  `${MCP_TOKEN_PREFIX}test-token-${id}`;

/**
 * An API wired like `VitNodeAPI` mounts MCP: the dispatch middleware first,
 * the endpoint before the plugins, admin paths behind `globalAdminMiddleware`
 * - with an in-memory database standing in for Postgres. The user of a
 * dispatched request is read the way the global middleware reads it.
 */
export const createMcpWorld = async ({
  config,
  extraTools = [],
  tokens = [],
}: {
  config?: McpConfig;
  /** Extra descriptors added to the registry (for paging). */
  extraTools?: McpToolDescriptor[];
  tokens?: McpWorldToken[];
} = {}) => {
  const calls: McpWorldCalls = { handler: 0, hook: 0, middleware: 0 };
  const plugins = [
    { modules: notesPlugin(calls), pluginId: NOTES_PLUGIN },
    { modules: otherPlugin(), pluginId: OTHER_PLUGIN },
  ];
  const registry = buildMcpRegistry([
    ...plugins.map(plugin => ({
      mcpTools: collectPluginMcpTools(plugin),
      pluginId: plugin.pluginId,
    })),
    ...(extraTools.length > 0
      ? [{ mcpTools: extraTools, pluginId: NOTES_PLUGIN }]
      : []),
  ]);

  const now = Date.now();
  const user = (id: number) => ({
    email: `${id}@test.com`,
    id,
    name: `user-${id}`,
    roleId: MEMBER_ROLE_ID,
  });
  const { db, rows } = createMemoryDb([
    [
      core_users,
      [
        user(MCP_USER.ADMIN),
        user(MCP_USER.ADMIN_NO_PERMISSION),
        user(MCP_USER.MEMBER),
        user(MCP_USER.SUSPENDED),
      ],
    ],
    [core_users_secondary_roles, []],
    [core_roles, [{ id: MEMBER_ROLE_ID, root: false }]],
    [
      core_admin_permissions,
      [
        {
          id: 1,
          permissions: [NOTES_VIEW],
          protected: false,
          roleId: null,
          unrestricted: false,
          userId: MCP_USER.ADMIN,
        },
        {
          id: 2,
          permissions: [],
          protected: false,
          roleId: null,
          unrestricted: false,
          userId: MCP_USER.ADMIN_NO_PERMISSION,
        },
      ],
    ],
    [core_moderators_permissions, []],
    [
      core_moderation_sanctions,
      [
        {
          endsAt: null,
          id: 1,
          revokedAt: null,
          source: "manual",
          startsAt: new Date(now - 60_000),
          type: "suspension",
          userId: MCP_USER.SUSPENDED,
        },
      ],
    ],
    [
      core_mcp_tokens,
      await Promise.all(
        tokens.map(async token => ({
          createdAt: new Date(now),
          expiresAt: token.expiresAt ?? new Date(now + 86_400_000),
          id: token.id,
          label: `token ${token.id}`,
          lastUsedAt: null,
          prefix: mcpTokenFor(token.id).slice(0, 14),
          revokedAt: token.revokedAt ?? null,
          tokenHash: await hashSessionToken(mcpTokenFor(token.id)),
          tools: token.tools,
          userId: token.userId,
        })),
      ),
    ],
  ]);

  const cache = createTestCache();
  const audit = { record: vi.fn(async () => Promise.resolve(undefined)) };
  const emit = vi.fn(async () => Promise.resolve(undefined));
  const resolved = resolveMcpConfig({ enabled: true, ...config });

  const app = new OpenAPIHono<EnvVitNode>().basePath("/api");
  const endpoints = createMcpEndpoints({
    app: app as never,
    cacheClient: null,
    config: resolved,
    registry,
  });

  app.use("*", mcpDispatchMiddleware);
  app.use("/mcp", endpoints.mark);
  app.use("/mcp/*", endpoints.mark);
  app.use("*", clientIpMiddleware);
  app.use("*", async (c: Context<EnvVitNode>, next: Next) => {
    c.set("core", {
      authorization: SESSION_AUTHORIZATION,
      mcp: { config: resolved, registry },
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    c.set("cache", cache);
    c.set("audit", audit as unknown as EnvVariablesVitNode["audit"]);
    c.set("events", { emit } as unknown as EnvVariablesVitNode["events"]);
    const frame = mcpDispatchOf(c);
    c.set(
      "user",
      frame
        ? await new UserModel().getUserById({ c, id: frame.principal.userId })
        : await new SessionModel(c).getUser(),
    );
    await next();
  });
  app.use(async (c, next) => {
    if (c.req.path.includes("/admin/")) {
      return await globalAdminMiddleware()(c, next);
    }

    return next();
  });

  endpoints.mount();
  for (const plugin of plugins) {
    const hono = new OpenAPIHono();
    for (const module of plugin.modules) {
      hono.route(`/${module.name}`, module.hono);
    }
    app.route(`/${plugin.pluginId}`, hono);
  }

  return { app, audit, cache, calls, db, emit, registry, rows };
};

export type McpWorld = Awaited<ReturnType<typeof createMcpWorld>>;

const JSON_RPC_HEADERS = {
  accept: "application/json, text/event-stream",
  "content-type": "application/json",
  "mcp-protocol-version": "2025-06-18",
};

/**
 * One JSON-RPC request to an MCP endpoint of the world, as an MCP client
 * sends it over Streamable HTTP. Returns the HTTP response.
 */
export const mcpRequest = async (
  world: McpWorld,
  {
    headers = {},
    method,
    params,
    path = "/api/mcp",
    token,
  }: {
    headers?: Record<string, string>;
    method: string;
    params?: Record<string, unknown>;
    path?: string;
    token?: string;
  },
): Promise<Response> =>
  await world.app.request(
    path,
    {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
      headers: {
        ...JSON_RPC_HEADERS,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      method: "POST",
    },
    { clientAddress: "198.51.100.4" },
  );

/** {@link mcpRequest}, parsed: the JSON-RPC `result` or `error`. */
export const mcpCall = async (
  world: McpWorld,
  options: Parameters<typeof mcpRequest>[1],
): Promise<{
  error?: { code: number; message: string };
  result?: Record<string, unknown>;
}> => {
  const response = await mcpRequest(world, options);
  const text = await response.text();
  const json = response.headers.get("content-type")?.includes("event-stream")
    ? text
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5))
        .join("")
    : text;

  return JSON.parse(json) as {
    error?: { code: number; message: string };
    result?: Record<string, unknown>;
  };
};
