import type { PermissionsStaffArgs } from "@vitnode/core/api/lib/permission-staff";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { CacheModel } from "@vitnode/core/api/lib/cache";
import { MemoryCacheStore } from "@vitnode/core/api/lib/cache-memory";
import { writeStaffPermissions } from "@vitnode/core/api/lib/staff-permission-cache";
import { describe, expect, it } from "vitest";

import { createCorrectionRoute } from "./create.route";

const ADMIN = { id: 9, roleId: 1 };

const db = {
  transaction: async <T>(run: (tx: unknown) => Promise<T>) =>
    await run({
      insert: () => ({
        values: (values: object) => ({
          returning: async () =>
            await Promise.resolve([
              {
                ...values,
                createdAt: new Date("2026-11-11T12:00:00.000Z"),
                id: 1,
              },
            ]),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => await Promise.resolve([{ id: 3 }]),
          }),
        }),
      }),
    }),
};

const fileAs = async (permissions: PermissionsStaffArgs[]) => {
  const cache = new CacheModel(
    null,
    { get: () => undefined } as unknown as Context,
    new MemoryCacheStore(),
  );
  await writeStaffPermissions(
    { get: (key: string) => (key === "cache" ? cache : undefined) } as Context,
    { type: "admin", userId: ADMIN.id },
    { permissions, root: false, staff: true },
  );
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: async () => {},
    } as unknown as Context["var"]["events"]);
    c.set("queue", {
      dispatch: async () => {},
    } as unknown as Context["var"]["queue"]);
    await next();
  });
  app.openapi(createCorrectionRoute.route, createCorrectionRoute.handler);

  return await app.request("/", {
    body: JSON.stringify({ articleId: 3, body: "The date was wrong." }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
};

describe("POST /admin/corrections", () => {
  it("answers 403 without the corrections permission", async () => {
    const res = await fileAs([
      { module: "articles", permission: "can_create", plugin: "newsroom" },
    ]);

    expect(res.status).toBe(403);
  });

  it("answers 201 with the correction, but not who filed it", async () => {
    const res = await fileAs([
      { module: "corrections", permission: "can_create", plugin: "newsroom" },
    ]);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      articleId: 3,
      body: "The date was wrong.",
      createdAt: "2026-11-11T12:00:00.000Z",
      id: 1,
    });
  });
});
