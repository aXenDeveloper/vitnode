// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";
import {
  DEFAULT_UPLOAD_MAX_FILES,
  DEFAULT_UPLOAD_MIME_TYPES,
  KILOBYTE,
} from "@/lib/upload-limits";

import { uploadLimitsUserFilesRoute } from "./upload-limits.route";

interface RoleRow {
  allowUploadFiles: boolean;
  maxStorageForSubmit: null | number;
  root: boolean;
  totalMaxStorage: null | number;
}

const role = (settings: Partial<RoleRow> = {}): RoleRow => ({
  allowUploadFiles: true,
  maxStorageForSubmit: null,
  root: false,
  totalMaxStorage: null,
  ...settings,
});

const mount = ({
  adapter = true,
  roles = [role()],
  secondaryRoleIds = [],
  usedBytes = 0,
  user = { id: 7, roleId: 1 },
}: {
  adapter?: boolean;
  roles?: RoleRow[];
  secondaryRoleIds?: number[];
  usedBytes?: number;
  user?: null | { id: number; roleId: number };
} = {}) => {
  const middleware: MiddlewareHandler = async (c, next) => {
    c.set("user", user);
    c.set("core", {
      storage: adapter ? { adapter: {} } : undefined,
    } as never);
    c.set("db", {
      select: () => ({
        from: (table: unknown) => ({
          where: async () =>
            Promise.resolve(
              table === core_users_secondary_roles
                ? secondaryRoleIds.map(roleId => ({ roleId }))
                : table === core_roles
                  ? roles
                  : table === core_files
                    ? [{ used: usedBytes }]
                    : [],
            ),
        }),
      }),
    } as never);
    await next();
  };

  const app = new OpenAPIHono();
  app.use("*", middleware);
  app.openapi(
    uploadLimitsUserFilesRoute.route,
    uploadLimitsUserFilesRoute.handler,
  );

  return app;
};

describe("uploadLimitsUserFilesRoute", () => {
  it("rejects a signed-out request", async () => {
    const res = await mount({ user: null }).request("/upload-limits");

    expect(res.status).toBe(401);
  });

  it("reports the merged role limits, usage and endpoint rules", async () => {
    const res = await mount({
      roles: [
        role({ maxStorageForSubmit: 100, totalMaxStorage: 200 }),
        role({ maxStorageForSubmit: 500, totalMaxStorage: 400 }),
      ],
      secondaryRoleIds: [2],
      usedBytes: 50 * KILOBYTE,
    }).request("/upload-limits");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      allowUpload: true,
      allowedMimeTypes: DEFAULT_UPLOAD_MIME_TYPES,
      maxBytesPerSubmit: 500 * KILOBYTE,
      maxFiles: DEFAULT_UPLOAD_MAX_FILES,
      maxTotalBytes: 400 * KILOBYTE,
      remainingBytes: 350 * KILOBYTE,
      usedBytes: 50 * KILOBYTE,
    });
  });

  it("leaves an unlimited quota without a remaining figure", async () => {
    const res = await mount({ usedBytes: 10 }).request("/upload-limits");

    expect(await res.json()).toMatchObject({
      allowUpload: true,
      maxTotalBytes: null,
      remainingBytes: null,
    });
  });

  it("refuses uploads when no storage adapter is configured", async () => {
    const res = await mount({ adapter: false }).request("/upload-limits");

    expect(await res.json()).toMatchObject({ allowUpload: false });
  });

  it("refuses uploads when no role grants them", async () => {
    const res = await mount({
      roles: [role({ allowUploadFiles: false })],
    }).request("/upload-limits");

    expect(await res.json()).toMatchObject({
      allowUpload: false,
      maxTotalBytes: 0,
      remainingBytes: 0,
    });
  });
});
