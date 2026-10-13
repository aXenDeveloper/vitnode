import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_content_containers } from "@/database/content-containers";
import { createTestCache } from "@/tests/cache";
import {
  testBoardContainers,
  testPolicyBoardContainers,
} from "@/tests/content-fixtures";
import {
  POLICY_PLUGIN_ID,
  policyReplies,
  policyTopics,
} from "@/tests/content-policies";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import type { ContentContainerUsageCheck } from "./service";

import { CONTENT_PERMISSIONS } from "../../const";
import { buildContentContainerAdminRoutes } from "./admin-routes";

const PLUGIN_ID = "@vitnode/example";
const OTHER_PLUGIN_ID = "@vitnode/other";
const MODULE = testBoardContainers.admin.permissionModule;
const ALL_PERMISSIONS = Object.values(CONTENT_PERMISSIONS);
const CREATED = new Date("2026-09-01T10:00:00.000Z");

const BOARD = { CHILD: 2, ELSEWHERE: 9, FULL: 3, MISSING: 99, ROOT: 1 };

const adminUser = { email: "test@test.com", id: 1, name: "Test", roleId: 1 };

const row = (
  id: number,
  slug: string,
  parentId: null | number,
  position: number,
  definitionId: string = testBoardContainers.id,
) => ({
  createdAt: CREATED,
  definitionId,
  id,
  metadata: {},
  name: slug,
  parentId,
  pluginId: PLUGIN_ID,
  position,
  slug,
  updatedAt: CREATED,
});

const holdsContent: ContentContainerUsageCheck = async (_tx, ids) =>
  await Promise.resolve(ids.includes(BOARD.FULL));

const routes = buildContentContainerAdminRoutes(testBoardContainers, {
  pluginId: PLUGIN_ID,
  usage: holdsContent,
});

const harness = async (
  permissions:
    | PermissionsStaffArgs[]
    | typeof ROOT_STAFF_PERMISSIONS = ROOT_STAFF_PERMISSIONS,
) => {
  const memory = createMemoryDb([
    [
      core_content_containers,
      [
        row(BOARD.ROOT, "root", null, 0),
        row(BOARD.CHILD, "child", BOARD.ROOT, 0),
        row(BOARD.FULL, "full", null, 1),
        row(BOARD.ELSEWHERE, "elsewhere", null, 0, "test.sections"),
      ],
    ],
  ]);
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: adminUser.id });

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("admin", { user: adminUser } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: async () => await Promise.resolve({ failures: [] }),
    } as unknown as Context["var"]["events"]);
    await next();
  };
  app.use("*", context);
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );
  for (const { handler, hook, route } of routes) {
    app.openapi(route, handler, hook as never);
  }

  const send = async (method: string, path: string, body?: unknown) =>
    await app.request(path, {
      method,
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
          }),
    });

  return { rows: () => memory.rows(core_content_containers), send };
};

describe("status mapping", () => {
  it("lists one collection in tree order", async () => {
    const { send } = await harness();

    const response = await send("GET", "/");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: number }[] };
    expect(body.items.map(item => item.id)).toEqual([
      BOARD.ROOT,
      BOARD.CHILD,
      BOARD.FULL,
    ]);
  });

  it.each([
    ["POST", "/", { name: "New board" }, 201],
    ["PATCH", `/${BOARD.CHILD}`, { name: "Renamed" }, 200],
    ["POST", `/${BOARD.CHILD}/move`, { parentId: null, position: 0 }, 200],
    ["DELETE", `/${BOARD.CHILD}`, undefined, 204],
  ])("answers %s %s with %i", async (method, path, body, status) => {
    const { send } = await harness();

    expect((await send(method, path, body)).status).toBe(status);
  });

  it("returns the created container", async () => {
    const { rows, send } = await harness();

    const response = await send("POST", "/", {
      metadata: { color: "#000000" },
      name: "New board",
      parentId: BOARD.ROOT,
    });

    const created = (await response.json()) as { id: number };
    expect(created).toMatchObject({
      depth: 2,
      metadata: { color: "#000000", locked: false },
      parentId: BOARD.ROOT,
      position: 1,
      slug: "new-board",
    });
    expect(rows().some(candidate => candidate.id === created.id)).toBe(true);
  });

  it.each([
    ["POST", "/", { name: "Taken", slug: "root" }, 409, "slugTaken"],
    [
      "POST",
      "/",
      { metadata: { color: "#1234567" }, name: "Loud" },
      400,
      "invalidMetadata",
    ],
    ["POST", "/", { name: "" }, 400, "invalidInput"],
    [
      "PATCH",
      `/${BOARD.CHILD}`,
      { metadata: { unknown: true } },
      400,
      "invalidMetadata",
    ],
    [
      "POST",
      `/${BOARD.CHILD}/move`,
      { parentId: null, position: -1 },
      400,
      "invalidInput",
    ],
    [
      "POST",
      "/",
      { name: "Lost", parentId: BOARD.ELSEWHERE },
      400,
      "parentNotFound",
    ],
    ["PATCH", `/${BOARD.MISSING}`, { name: "Gone" }, 404, "notFound"],
    ["PATCH", `/${BOARD.ELSEWHERE}`, { name: "Not mine" }, 404, "notFound"],
    ["PATCH", `/${BOARD.CHILD}`, { slug: "root" }, 409, "slugTaken"],
    [
      "POST",
      `/${BOARD.ROOT}/move`,
      { parentId: BOARD.CHILD, position: 0 },
      400,
      "cycle",
    ],
    [
      "POST",
      `/${BOARD.MISSING}/move`,
      { parentId: null, position: 0 },
      404,
      "notFound",
    ],
    ["DELETE", `/${BOARD.ROOT}`, undefined, 409, "hasChildren"],
    ["DELETE", `/${BOARD.FULL}`, undefined, 409, "hasContent"],
    ["DELETE", `/${BOARD.MISSING}`, undefined, 404, "notFound"],
  ])(
    "refuses %s %s with %i and a code",
    async (method, path, body, status, code) => {
      const { send } = await harness();

      const response = await send(method, path, body);

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        code,
        message: expect.any(String),
      });
    },
  );
});

describe("permission matrix", () => {
  const DOCUMENTED: Record<string, string> = {
    "DELETE /{id}": CONTENT_PERMISSIONS.delete,
    "GET /": CONTENT_PERMISSIONS.view,
    "PATCH /{id}": CONTENT_PERMISSIONS.edit,
    "POST /": CONTENT_PERMISSIONS.create,
    "POST /{id}/move": CONTENT_PERMISSIONS.edit,
  };

  const REQUESTS: Record<string, [string, string, unknown]> = {
    "DELETE /{id}": ["DELETE", `/${BOARD.CHILD}`, undefined],
    "GET /": ["GET", "/", undefined],
    "PATCH /{id}": ["PATCH", `/${BOARD.CHILD}`, { name: "Renamed" }],
    "POST /": ["POST", "/", { name: "New board" }],
    "POST /{id}/move": [
      "POST",
      `/${BOARD.CHILD}/move`,
      { parentId: null, position: 0 },
    ],
  };

  const grantOf = (
    permissions: readonly string[],
    plugin = PLUGIN_ID,
  ): PermissionsStaffArgs[] =>
    permissions.map(permission => ({ module: MODULE, permission, plugin }));

  const statusWith = async (label: string, grant: PermissionsStaffArgs[]) => {
    const { send } = await harness(grant);
    const [method, path, body] = REQUESTS[label];

    return (await send(method, path, body)).status;
  };

  it("documents a permission for exactly the routes the builder produced", () => {
    expect(
      routes
        .map(({ route }) => `${route.method.toUpperCase()} ${route.path}`)
        .sort(),
    ).toEqual(Object.keys(DOCUMENTED).sort());
  });

  it.each(Object.entries(DOCUMENTED))(
    "%s is refused without %s and allowed with only it",
    async (label, permission) => {
      await expect(statusWith(label, [])).resolves.toBe(403);
      await expect(
        statusWith(
          label,
          grantOf(ALL_PERMISSIONS.filter(other => other !== permission)),
        ),
      ).resolves.toBe(403);
      await expect(
        statusWith(label, grantOf([permission])),
      ).resolves.toBeLessThan(300);
    },
  );

  it.each(Object.entries(DOCUMENTED))(
    "%s is refused when %s was granted for another plugin",
    async (label, permission) => {
      await expect(
        statusWith(label, grantOf([permission], OTHER_PLUGIN_ID)),
      ).resolves.toBe(403);
    },
  );
});

describe("publishing policies", () => {
  const POLICY_MODULE = testPolicyBoardContainers.admin.permissionModule;
  const TOPIC = policyTopics.definition.id;
  const REPLY = policyReplies.definition.id;
  const PARENT = 1;
  const CHILD = 2;

  const policyRoutes = buildContentContainerAdminRoutes(
    testPolicyBoardContainers,
    { pluginId: POLICY_PLUGIN_ID, usage: holdsContent },
  );

  const policyHarness = async (
    permissions:
      | PermissionsStaffArgs[]
      | typeof ROOT_STAFF_PERMISSIONS = ROOT_STAFF_PERMISSIONS,
  ) => {
    const memory = createMemoryDb([
      [
        core_content_containers,
        [
          {
            ...row(PARENT, "parent", null, 0, testPolicyBoardContainers.id),
            pluginId: POLICY_PLUGIN_ID,
            policies: { [TOPIC]: { publish: "approve" } },
          },
          {
            ...row(CHILD, "child", PARENT, 0, testPolicyBoardContainers.id),
            pluginId: POLICY_PLUGIN_ID,
            policies: { [TOPIC]: { authorEdit: "never" } },
          },
        ],
      ],
    ]);
    const cache = createTestCache();
    await grantStaffPermissions(cache, { permissions, userId: adminUser.id });

    const app = new OpenAPIHono();
    app.use("*", async (c, next) => {
      c.set("admin", { user: adminUser } as unknown as Context["var"]["admin"]);
      c.set("cache", cache);
      c.set("db", memory.db as unknown as Context["var"]["db"]);
      c.set("events", {
        emit: async () => await Promise.resolve({ failures: [] }),
      } as unknown as Context["var"]["events"]);
      c.set("core", {
        contentModels: [
          { model: policyTopics, pluginId: POLICY_PLUGIN_ID },
          { model: policyReplies, pluginId: POLICY_PLUGIN_ID },
        ],
      } as unknown as Context["var"]["core"]);
      await next();
    });
    app.onError((error, c) =>
      error instanceof HTTPException
        ? error.getResponse()
        : c.json({ error: String(error) }, 500),
    );
    for (const { handler, hook, route } of policyRoutes) {
      app.openapi(route, handler, hook as never);
    }

    const send = async (method: string, path: string, body?: unknown) =>
      await app.request(path, {
        method,
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { "content-type": "application/json" },
            }),
      });

    return { rows: () => memory.rows(core_content_containers), send };
  };

  const grantOf = (permissions: readonly string[]): PermissionsStaffArgs[] =>
    permissions.map(permission => ({
      module: POLICY_MODULE,
      permission,
      plugin: POLICY_PLUGIN_ID,
    }));

  it.each([
    ["GET", CONTENT_PERMISSIONS.view, undefined],
    ["PUT", CONTENT_PERMISSIONS.edit, { overrides: {} }],
  ])(
    "%s /{id}/policies is refused without %s and allowed with only it",
    async (method, permission, body) => {
      const statusWith = async (grant: PermissionsStaffArgs[]) => {
        const { send } = await policyHarness(grant);

        return (await send(method, `/${CHILD}/policies`, body)).status;
      };

      await expect(statusWith([])).resolves.toBe(403);
      await expect(
        statusWith(
          grantOf(ALL_PERMISSIONS.filter(other => other !== permission)),
        ),
      ).resolves.toBe(403);
      await expect(statusWith(grantOf([permission]))).resolves.toBe(200);
    },
  );

  it("reports the container's overrides, what it inherits and where each value comes from", async () => {
    const { send } = await policyHarness();

    const response = await send("GET", `/${CHILD}/policies`);

    expect(response.status).toBe(200);
    const report = (await response.json()) as {
      contentTypes: { contentTypeId: string }[];
      overrides: unknown;
    };
    expect(report.overrides).toEqual({ [TOPIC]: { authorEdit: "never" } });
    expect(report.contentTypes).toEqual([
      {
        contentTypeId: TOPIC,
        effective: {
          authorEdit: "never",
          authorEditMinutes: 60,
          create: "members",
          edits: "immediate",
          publish: "approve",
        },
        inherited: {
          authorEdit: "always",
          authorEditMinutes: 60,
          create: "members",
          edits: "immediate",
          publish: "approve",
        },
        pluginId: POLICY_PLUGIN_ID,
        sources: {
          authorEdit: { containerId: CHILD, kind: "container" },
          authorEditMinutes: { kind: "fallback" },
          create: { kind: "fallback" },
          edits: { kind: "default" },
          publish: { containerId: PARENT, kind: "container" },
        },
      },
      expect.objectContaining({
        contentTypeId: REPLY,
        effective: expect.objectContaining({
          authorEdit: "window",
          publish: "immediate",
        }),
        sources: expect.objectContaining({
          authorEdit: { kind: "contentType" },
          publish: { kind: "default" },
        }),
      }),
    ]);
  });

  it("replaces the overrides", async () => {
    const { rows, send } = await policyHarness();
    const overrides = { [REPLY]: { publish: "approve" } };

    const response = await send("PUT", `/${CHILD}/policies`, { overrides });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ overrides });
    expect(rows().find(candidate => candidate.id === CHILD)?.policies).toEqual(
      overrides,
    );
  });

  it.each([
    [
      "a content type not filed in the collection",
      { "test.topic": { publish: "approve" } },
      "invalidPolicy",
    ],
    ["an unknown value", { [TOPIC]: { publish: "sometimes" } }, "invalidInput"],
    ["an unknown key", { [TOPIC]: { moderated: true } }, "invalidInput"],
  ])(
    "refuses %s with 400 and keeps the overrides",
    async (_label, overrides, code) => {
      const { rows, send } = await policyHarness();
      const before = rows();

      const response = await send("PUT", `/${CHILD}/policies`, { overrides });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code,
        message: expect.any(String),
      });
      expect(rows()).toEqual(before);
    },
  );
});
