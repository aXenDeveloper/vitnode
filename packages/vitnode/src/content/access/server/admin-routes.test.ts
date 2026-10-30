import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { AccessWorld, AccessWorldOptions } from "@/tests/content-access";

import { core_audit_logs } from "@/database/audit";
import { core_content_access_rules } from "@/database/content-access";
import { core_languages_words } from "@/database/languages";
import {
  ACCESS_PLUGIN_ID,
  BOARD,
  CATEGORY,
  createAccessWorld,
  ROLE,
  testAccessBoards,
  testAccessCategoryContentType,
  USER,
} from "@/tests/content-access";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { CONTENT_PERMISSIONS } from "../../const";
import { buildContentAccessAdminRoutes } from "./admin-routes";

const ADMIN = USER.ROOT;

const FAMILIES = {
  boards: {
    id: testAccessBoards.id,
    permissionModule: testAccessBoards.admin.permissionModule,
  },
  categories: {
    id: testAccessCategoryContentType.id,
    permissionModule: testAccessCategoryContentType.permissionModule,
  },
};

const harness = async (
  options?: AccessWorldOptions,
  family: (typeof FAMILIES)[keyof typeof FAMILIES] = FAMILIES.boards,
) => {
  const world: AccessWorld = await createAccessWorld(options);
  await grantStaffPermissions(world.cache, {
    permissions: [CONTENT_PERMISSIONS.view, CONTENT_PERMISSIONS.edit].map(
      permission => ({
        module: family.permissionModule,
        permission,
        plugin: ACCESS_PLUGIN_ID,
      }),
    ),
    userId: ADMIN,
  });
  await world.memory.db.insert(core_languages_words).values(
    [
      [ROLE.MEMBER, "Member"],
      [ROLE.VIP, "VIP"],
    ].map(([itemId, value]) => ({
      itemId: itemId as number,
      languageCode: "en",
      pluginCode: "core",
      tableName: "core_roles",
      value: value as string,
      variable: "name",
    })),
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    for (const [key, value] of Object.entries(world.contextValues(ADMIN))) {
      c.set(key as never, value as never);
    }
    c.set("admin" as never, { user: { id: ADMIN } } as never);
    await next();
  });
  app.onError((error, c) =>
    error instanceof HTTPException
      ? error.getResponse()
      : c.json({ error: String(error) }, 500),
  );
  for (const { handler, hook, route } of buildContentAccessAdminRoutes({
    familyId: family.id,
    permissionModule: family.permissionModule,
    pluginId: ACCESS_PLUGIN_ID,
  })) {
    app.openapi(route, handler, hook as never);
  }

  const save = async (scopeId: number, overrides: unknown) =>
    await app.request(`/${scopeId}/access`, {
      body: JSON.stringify({ overrides }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  return {
    entries: () => world.memory.rows(core_audit_logs),
    save,
    world,
  };
};

describe("PUT /{id}/access", () => {
  it.each([
    [
      "an unknown role",
      BOARD.OPEN,
      { read: { mode: "roles", roleIds: [999] } },
      400,
      "unknownRole",
    ],
    [
      "the guest role",
      BOARD.OPEN,
      { read: { mode: "roles", roleIds: [ROLE.GUEST] } },
      400,
      "unknownRole",
    ],
    [
      "a roles audience naming no role",
      BOARD.OPEN,
      { read: { mode: "roles", roleIds: [] } },
      400,
      "invalidAccess",
    ],
    [
      "a scope that does not exist",
      99,
      { view: { mode: "members" } },
      404,
      "notFound",
    ],
    [
      "restricted downloads without a private store",
      BOARD.OPEN,
      { downloadAttachments: { mode: "members" } },
      400,
      "unsupportedStorage",
    ],
  ])("refuses %s", async (_label, scopeId, overrides, status, code) => {
    const { entries, save, world } = await harness({ privateStorage: false });
    const rules = world.memory.rows(core_content_access_rules);

    const response = await save(scopeId, overrides);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code });
    expect(world.emitted).toEqual([]);
    expect(entries()).toEqual([]);
    expect(world.memory.rows(core_content_access_rules)).toEqual(rules);
  });

  it("saves the rules, announces what changed, and applies them on the next request", async () => {
    const { save, world } = await harness();

    const response = await save(BOARD.OPEN, {
      read: { mode: "everyone" },
      view: { mode: "members" },
    });

    expect(response.status).toBe(200);
    expect(world.emitted).toEqual([
      {
        name: "content.access.updated",
        payload: {
          changedActions: ["view", "read"],
          family: testAccessBoards.id,
          pluginId: ACCESS_PLUGIN_ID,
          scopeId: String(BOARD.OPEN),
          userId: ADMIN,
        },
      },
    ]);

    // The guest loses the board and the child under it.
    const boards = (await (await world.send("GET", "/boards")).json()) as {
      items: { id: number }[];
    };
    expect(boards.items.map(item => item.id)).toEqual([BOARD.READERS]);
  });

  it.each([
    [
      "a board",
      FAMILIES.boards,
      BOARD.VIP,
      {
        read: { mode: "members" },
        view: { mode: "roles", roleIds: [ROLE.MEMBER, ROLE.VIP] },
      },
      {
        changes: {
          access_read: { from: "inherit", to: "members" },
          access_view: { from: "roles: VIP", to: "roles: Member, VIP" },
        },
        contentTypeId: null,
        targetLabel: `Board ${BOARD.VIP}`,
        targetType: testAccessBoards.id,
      },
    ],
    [
      "a category",
      FAMILIES.categories,
      CATEGORY.MEMBERS,
      { view: { mode: "everyone" } },
      {
        changes: {
          access_read: { from: "members", to: "inherit" },
          access_view: { from: "inherit", to: "everyone" },
        },
        contentTypeId: testAccessCategoryContentType.id,
        targetLabel: `Category ${CATEGORY.MEMBERS}`,
        targetType: testAccessCategoryContentType.id,
      },
    ],
  ])(
    "records one content.access_updated entry for %s",
    async (_label, family, scopeId, overrides, expected) => {
      const { entries, save } = await harness(undefined, family);

      const response = await save(scopeId, overrides);

      expect(response.status).toBe(200);
      expect(entries()).toEqual([
        expect.objectContaining({
          ...expected,
          action: "content.access_updated",
          actorId: ADMIN,
          actorType: "staff",
          area: "admin",
          pluginId: ACCESS_PLUGIN_ID,
          targetId: String(scopeId),
        }),
      ]);
    },
  );

  it("announces and records nothing when the saved rules equal the stored ones", async () => {
    const { entries, save, world } = await harness();

    const response = await save(BOARD.VIP, {
      view: { mode: "roles", roleIds: [ROLE.VIP] },
    });

    expect(response.status).toBe(200);
    expect(world.emitted).toEqual([]);
    expect(entries()).toEqual([]);
  });
});
