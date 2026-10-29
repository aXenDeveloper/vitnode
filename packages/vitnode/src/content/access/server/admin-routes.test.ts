import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { AccessWorld, AccessWorldOptions } from "@/tests/content-access";

import {
  ACCESS_PLUGIN_ID,
  BOARD,
  createAccessWorld,
  ROLE,
  testAccessBoards,
  USER,
} from "@/tests/content-access";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { CONTENT_PERMISSIONS } from "../../const";
import { buildContentAccessAdminRoutes } from "./admin-routes";

const ADMIN = USER.ROOT;

const harness = async (options?: AccessWorldOptions) => {
  const world: AccessWorld = await createAccessWorld(options);
  await grantStaffPermissions(world.cache, {
    permissions: [CONTENT_PERMISSIONS.view, CONTENT_PERMISSIONS.edit].map(
      permission => ({
        module: testAccessBoards.admin.permissionModule,
        permission,
        plugin: ACCESS_PLUGIN_ID,
      }),
    ),
    userId: ADMIN,
  });

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
    familyId: testAccessBoards.id,
    permissionModule: testAccessBoards.admin.permissionModule,
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

  return { save, world };
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
    const { save, world } = await harness({ privateStorage: false });

    const response = await save(scopeId, overrides);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code });
    expect(world.emitted).toEqual([]);
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

  it("announces nothing when the saved rules equal the stored ones", async () => {
    const { save, world } = await harness();

    const response = await save(BOARD.VIP, {
      view: { mode: "roles", roleIds: [ROLE.VIP] },
    });

    expect(response.status).toBe(200);
    expect(world.emitted).toEqual([]);
  });
});
