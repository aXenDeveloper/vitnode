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
  const insertValues = vi.fn().mockResolvedValue(undefined);
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

    // Admin uploading on behalf of user 123 — explicit owner wins over admin (42).
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
});

describe("StorageModel.delete", () => {
  it("delegates to the adapter", async () => {
    const { ctx, del } = makeCtx();

    await new StorageModel(ctx).delete("month_7_2026/avatars/x.png");

    expect(del).toHaveBeenCalledWith("month_7_2026/avatars/x.png");
  });
});
