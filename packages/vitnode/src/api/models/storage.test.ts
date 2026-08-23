import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { StorageModel } from "./storage";

const makeCtx = (
  overrides: { admin?: unknown; storage?: unknown } = {},
): {
  ctx: Context;
  del: ReturnType<typeof vi.fn>;
  insertValues: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
} => {
  const upload = vi
    .fn()
    .mockImplementation(async ({ key }: { key: string }) =>
      Promise.resolve({ key, url: `https://cdn.test/${key}` }),
    );
  const del = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([{ id: 11 }]),
  }));
  const store: Record<string, unknown> = {
    admin: "admin" in overrides ? overrides.admin : null,
    core: {
      storage:
        "storage" in overrides
          ? overrides.storage
          : { adapter: { delete: del, getUrl: (k: string) => k, upload } },
    },
    db: { insert: vi.fn(() => ({ values: insertValues })) },
    plugin: { id: "@vitnode/core" },
    user: { id: 7 },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    del,
    insertValues,
    upload,
  };
};

const makeDeleteCtx = (
  row: undefined | { key: string },
  overrides: { storage?: unknown } = {},
): {
  ctx: Context;
  del: ReturnType<typeof vi.fn>;
  deleteWhere: ReturnType<typeof vi.fn>;
} => {
  const del = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const store: Record<string, unknown> = {
    core: {
      storage:
        "storage" in overrides
          ? overrides.storage
          : {
              adapter: {
                delete: del,
                getUrl: (k: string) => k,
                upload: vi.fn(),
              },
            },
    },
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(row ? [row] : []),
          })),
        })),
      })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    del,
    deleteWhere,
  };
};

describe("StorageModel.upload", () => {
  it("uploads under month_x_y/{folder} with a generated file name", async () => {
    const { ctx, insertValues, upload } = makeCtx();
    const file = new File(["hello"], "photo.png", { type: "image/png" });

    const result = await new StorageModel(ctx).upload({
      file,
      folder: "avatars",
    });

    expect(upload).toHaveBeenCalledTimes(1);
    const arg = upload.mock.calls[0][0];
    expect(arg.key).toMatch(
      /^month_\d{1,2}_\d{4}\/avatars\/[0-9a-f-]{36}\.png$/,
    );
    expect(arg.contentType).toBe("image/png");
    expect(Buffer.isBuffer(arg.body)).toBe(true);
    expect(result.url).toContain(arg.key);

    // records file metadata in core_files
    expect(insertValues).toHaveBeenCalledTimes(1);
    const row = insertValues.mock.calls[0][0];
    expect(row).toMatchObject({
      folder: "avatars",
      key: arg.key,
      mimeType: "image/png",
      name: "photo.png",
      pluginId: "@vitnode/core",
      userId: 7,
    });
    expect(typeof row.size).toBe("number");
  });

  it("records the admin's user id when uploaded from an admin session", async () => {
    const { ctx, insertValues } = makeCtx({ admin: { user: { id: 42 } } });
    const file = new File(["hi"], "a.png", { type: "image/png" });

    await new StorageModel(ctx).upload({ file, folder: "avatars" });

    // admin.user.id (42) wins over the regular session user (7)
    expect(insertValues.mock.calls[0][0].userId).toBe(42);
  });

  it("uses an explicit userId over the detected session user", async () => {
    const { ctx, insertValues } = makeCtx({ admin: { user: { id: 42 } } });
    const file = new File(["hi"], "a.png", { type: "image/png" });

    // Admin uploading on behalf of user 123 - explicit owner wins over admin (42).
    await new StorageModel(ctx).upload({
      file,
      folder: "avatars",
      userId: 123,
    });

    expect(insertValues.mock.calls[0][0].userId).toBe(123);
  });

  it("throws when no storage provider is configured", async () => {
    const { ctx, upload } = makeCtx({ storage: undefined });
    const file = new File(["hi"], "a.png", { type: "image/png" });

    await expect(
      new StorageModel(ctx).upload({ file, folder: "avatars" }),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file over maxBytes without uploading", async () => {
    const { ctx, upload } = makeCtx();
    const file = new File([new Uint8Array(11)], "big.png", {
      type: "image/png",
    });

    await expect(
      new StorageModel(ctx).upload({ file, folder: "avatars", maxBytes: 10 }),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a disallowed mime type without uploading", async () => {
    const { ctx, upload } = makeCtx();
    const file = new File(["x"], "script.sh", { type: "application/x-sh" });

    await expect(
      new StorageModel(ctx).upload({
        file,
        folder: "avatars",
        allowedMimeTypes: ["image/png", "image/jpeg"],
      }),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads when the file passes size and type validation", async () => {
    const { ctx, upload } = makeCtx();
    const file = new File(["ok"], "photo.png", { type: "image/png" });

    await new StorageModel(ctx).upload({
      file,
      folder: "avatars",
      maxBytes: 1024,
      allowedMimeTypes: ["image/png"],
    });

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("accepts a wildcard mime allowlist", async () => {
    const { ctx, upload } = makeCtx();
    const file = new File(["ok"], "photo.gif", { type: "image/gif" });

    await new StorageModel(ctx).upload({
      file,
      folder: "avatars",
      allowedMimeTypes: ["image/*"],
    });

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("returns the created core_files row alongside the key and url", async () => {
    const { ctx } = makeCtx();
    const file = new File(["ok"], "photo.png", { type: "image/png" });

    const result = await new StorageModel(ctx).upload({
      file,
      folder: "avatars",
    });

    expect(result).toMatchObject({
      id: 11,
      mimeType: "image/png",
      name: "photo.png",
      size: 2,
    });
    expect(result.url).toContain(result.key);
  });
});

describe("StorageModel.delete", () => {
  it("delegates to the adapter", async () => {
    const { ctx, del } = makeCtx();

    await new StorageModel(ctx).delete("month_7_2026/avatars/x.png");

    expect(del).toHaveBeenCalledWith("month_7_2026/avatars/x.png");
  });
});

describe("StorageModel.deleteFile", () => {
  it("deletes the storage object then the database row", async () => {
    const key = "month_7_2026/avatars/x.png";
    const { ctx, del, deleteWhere } = makeDeleteCtx({ key });

    await new StorageModel(ctx).deleteFile(1);

    expect(del).toHaveBeenCalledWith(key);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("throws 404 when the file does not exist", async () => {
    const { ctx, del, deleteWhere } = makeDeleteCtx(undefined);

    await expect(new StorageModel(ctx).deleteFile(999)).rejects.toThrow();
    expect(del).not.toHaveBeenCalled();
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("still removes the row when no storage adapter is configured", async () => {
    const { ctx, del, deleteWhere } = makeDeleteCtx(
      { key: "a/b.png" },
      { storage: undefined },
    );

    await new StorageModel(ctx).deleteFile(1);

    expect(del).not.toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("deletes when scoped to the owning user", async () => {
    const { ctx, del, deleteWhere } = makeDeleteCtx({ key: "a/b.png" });

    await new StorageModel(ctx).deleteFile(1, 7);

    expect(del).toHaveBeenCalledWith("a/b.png");
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("throws 404 when the file is not owned by the user", async () => {
    // The scoped lookup returns nothing, mirroring a row owned by someone else.
    const { ctx, del, deleteWhere } = makeDeleteCtx(undefined);

    await expect(new StorageModel(ctx).deleteFile(1, 7)).rejects.toThrow();
    expect(del).not.toHaveBeenCalled();
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("removes the row even when the storage delete fails", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("gone"));
    const { ctx, deleteWhere } = makeDeleteCtx(
      { key: "a/b.png" },
      {
        storage: {
          adapter: {
            delete: failing,
            getUrl: (k: string) => k,
            upload: vi.fn(),
          },
        },
      },
    );

    await new StorageModel(ctx).deleteFile(1);

    expect(failing).toHaveBeenCalledWith("a/b.png");
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
