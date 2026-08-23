// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";
import { KILOBYTE } from "@/lib/upload-limits";

import { uploadUserFilesRoute } from "./upload.route";

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

/**
 * The three reads behind the guard - secondary roles, the roles themselves and
 * the space already used - answered by which table they select from.
 */
const dbStub = ({
  roles,
  usedBytes,
}: {
  roles: RoleRow[];
  usedBytes: number;
}) => ({
  select: () => ({
    from: (table: unknown) => ({
      where: async () =>
        Promise.resolve(
          table === core_users_secondary_roles
            ? []
            : table === core_roles
              ? roles
              : table === core_files
                ? [{ used: usedBytes }]
                : [],
        ),
    }),
  }),
});

const mount = ({
  adapter = true,
  roles = [role()],
  upload,
  uploads,
  usedBytes = 0,
  user = { id: 7, roleId: 1 },
}: {
  adapter?: boolean;
  roles?: RoleRow[];
  upload?: ReturnType<typeof vi.fn>;
  uploads?: Record<string, unknown>;
  usedBytes?: number;
  user?: null | { id: number; roleId: number };
} = {}) => {
  let nextId = 100;
  const uploadMock =
    upload ??
    vi.fn(async ({ file }: { file: File }) =>
      Promise.resolve({
        id: nextId++,
        key: `month_1_2026/uploads/${file.name}`,
        mimeType: file.type,
        name: file.name,
        size: file.size,
        url: `https://cdn.test/${file.name}`,
      }),
    );
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const emit = vi.fn().mockResolvedValue(undefined);

  const middleware: MiddlewareHandler = async (c, next) => {
    c.set("user", user);
    c.set("core", {
      storage: adapter ? { adapter: {}, uploads } : undefined,
    } as never);
    c.set("db", dbStub({ roles, usedBytes }) as never);
    c.set("storage", { deleteFile, upload: uploadMock } as never);
    c.set("events", { emit } as never);
    await next();
  };

  const app = new OpenAPIHono();
  app.use("*", middleware);
  app.openapi(uploadUserFilesRoute.route, uploadUserFilesRoute.handler);

  return { app, deleteFile, emit, upload: uploadMock };
};

const body = (...files: [name: string, type: string, size: number][]) => {
  const formData = new FormData();
  for (const [name, type, size] of files) {
    formData.append("files", new File([new Uint8Array(size)], name, { type }));
  }

  return { body: formData, method: "POST" };
};

describe("uploadUserFilesRoute", () => {
  it("rejects a signed-out request", async () => {
    const { app, upload } = mount({ user: null });

    const res = await app.request("/", body(["a.png", "image/png", 10]));

    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a role that may not upload", async () => {
    const { app, upload } = mount({
      roles: [role({ allowUploadFiles: false })],
    });

    const res = await app.request("/", body(["a.png", "image/png", 10]));

    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects when no storage adapter is configured", async () => {
    const { app, upload } = mount({ adapter: false });

    const res = await app.request("/", body(["a.png", "image/png", 10]));

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads every file of the batch and reports the new usage", async () => {
    const { app, emit, upload } = mount({ usedBytes: 500 });

    const res = await app.request(
      "/",
      body(["a.png", "image/png", 10], ["b.pdf", "application/pdf", 20]),
    );

    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(2);
    // The owner is pinned to the session user, never taken from the request.
    expect(upload.mock.calls[0][0]).toMatchObject({
      folder: "uploads",
      userId: 7,
    });
    expect(await res.json()).toEqual({
      files: [
        {
          id: 100,
          mimeType: "image/png",
          name: "a.png",
          size: 10,
          url: "https://cdn.test/a.png",
        },
        {
          id: 101,
          mimeType: "application/pdf",
          name: "b.pdf",
          size: 20,
          url: "https://cdn.test/b.pdf",
        },
      ],
      usedBytes: 530,
    });
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0]).toEqual([
      "file.uploaded",
      {
        fileId: 100,
        folder: "uploads",
        mimeType: "image/png",
        name: "a.png",
        size: 10,
        userId: 7,
      },
    ]);
  });

  it("accepts a single file, which arrives unwrapped", async () => {
    const { app, upload } = mount();

    const res = await app.request("/", body(["only.png", "image/png", 10]));

    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("stores nothing when one file in the batch has a disallowed type", async () => {
    const { app, upload } = mount();

    const res = await app.request(
      "/",
      body(["a.png", "image/png", 10], ["b.sh", "application/x-sh", 10]),
    );

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("honors a configured mime allowlist and folder", async () => {
    const { app, upload } = mount({
      uploads: { allowedMimeTypes: ["image/*"], folder: "gallery" },
    });

    expect(
      (await app.request("/", body(["a.pdf", "application/pdf", 10]))).status,
    ).toBe(400);

    const res = await app.request("/", body(["a.gif", "image/gif", 10]));

    expect(res.status).toBe(200);
    expect(upload.mock.calls[0][0]).toMatchObject({ folder: "gallery" });
  });

  it("rejects more files than the configured maximum", async () => {
    const { app, upload } = mount({ uploads: { maxFiles: 1 } });

    const res = await app.request(
      "/",
      body(["a.png", "image/png", 10], ["b.png", "image/png", 10]),
    );

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("measures the per-submit limit against the whole batch", async () => {
    const { app, upload } = mount({
      roles: [role({ maxStorageForSubmit: 1 })],
    });

    const res = await app.request(
      "/",
      body(
        ["a.png", "image/png", KILOBYTE - 1],
        ["b.png", "image/png", KILOBYTE - 1],
      ),
    );

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a batch that would run past the storage quota", async () => {
    const { app, upload } = mount({
      roles: [role({ totalMaxStorage: 2 })],
      usedBytes: 2 * KILOBYTE - 5,
    });

    const res = await app.request("/", body(["a.png", "image/png", 10]));

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("lets a root role past every limit", async () => {
    const { app, upload } = mount({
      roles: [
        role({
          allowUploadFiles: false,
          maxStorageForSubmit: 0,
          root: true,
          totalMaxStorage: 0,
        }),
      ],
      usedBytes: 99 * KILOBYTE,
    });

    const res = await app.request("/", body(["a.png", "image/png", 4096]));

    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("removes what it already stored when a later file fails", async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({
        id: 100,
        key: "k",
        mimeType: "image/png",
        name: "a.png",
        size: 10,
        url: "u",
      })
      .mockRejectedValueOnce(new Error("adapter is down"));
    const { app, deleteFile } = mount({ upload });

    const res = await app.request(
      "/",
      body(["a.png", "image/png", 10], ["b.png", "image/png", 10]),
    );

    expect(res.status).toBe(500);
    expect(deleteFile).toHaveBeenCalledWith(100, 7);
  });
});
