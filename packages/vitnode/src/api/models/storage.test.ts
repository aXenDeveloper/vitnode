import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";

import { core_content_file_refs } from "@/database/content";

import { STORAGE_FILE_IN_USE, StorageModel } from "./storage";

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
  // `upload` returns the created `core_files` row, so the insert resolves to one:
  // the id is what a Content Engine file column is going to hold.
  // The argument is typed only so `insertValues.mock.calls[0][0]` is the recorded
  // row rather than `never`; the body has no use for it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const insertValues = vi.fn((_values: Record<string, unknown>) => ({
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

/**
 * A context whose delete transaction behaves like the real one.
 *
 * `row` is what the `core_files` delete returns - `undefined` for "no such file"
 * - and `referenceError` makes that statement fail the way Postgres does when a
 * live content row still points at the file. `pins` is how many retained
 * revisions hold it, which is the *other* way a delete is refused and the only
 * one `force` can get past.
 *
 * `transaction` propagates a throw the way Drizzle does, and records it: the
 * un-forced refusal relies on the rollback to put the pins back, so a test that
 * checks the file survived has to be able to check that too. The order the model
 * does things in is what these tests are about, so `deleteReturning` is the spy
 * that proves the database was asked *before* the blob was touched.
 */
const makeDeleteCtx = (
  row: undefined | { key: string },
  overrides: {
    pins?: number;
    referenceError?: unknown;
    storage?: unknown;
  } = {},
): {
  ctx: Context;
  del: ReturnType<typeof vi.fn>;
  deleteReturning: ReturnType<typeof vi.fn>;
  pinsReturning: ReturnType<typeof vi.fn>;
  rolledBack: () => boolean;
} => {
  const del = vi.fn().mockResolvedValue(undefined);
  const deleteReturning =
    "referenceError" in overrides
      ? vi.fn().mockRejectedValue(overrides.referenceError)
      : vi.fn().mockResolvedValue(row ? [row] : []);
  const pinsReturning = vi.fn().mockResolvedValue(
    Array.from({ length: overrides.pins ?? 0 }, (_, index) => ({
      id: index + 1,
    })),
  );

  let rolledBack = false;
  const tx = {
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => ({
        returning:
          table === core_content_file_refs ? pinsReturning : deleteReturning,
      })),
    })),
  };

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
      transaction: async (body: (handle: typeof tx) => Promise<unknown>) => {
        try {
          return await body(tx);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    del,
    deleteReturning,
    pinsReturning,
    rolledBack: () => rolledBack,
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
});

describe("StorageModel.delete", () => {
  it("delegates to the adapter", async () => {
    const { ctx, del } = makeCtx();

    await new StorageModel(ctx).delete("month_7_2026/avatars/x.png");

    expect(del).toHaveBeenCalledWith("month_7_2026/avatars/x.png");
  });
});

describe("StorageModel.deleteFile", () => {
  it("deletes the database row first, then the storage object", async () => {
    const key = "month_7_2026/avatars/x.png";
    const { ctx, del, deleteReturning } = makeDeleteCtx({ key });

    await new StorageModel(ctx).deleteFile(1);

    // The order is the contract: Postgres is what knows whether anything still
    // references the file, so the row goes first and the bytes follow only once
    // it is gone.
    expect(deleteReturning).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(key);
    expect(deleteReturning.mock.invocationCallOrder[0]).toBeLessThan(
      del.mock.invocationCallOrder[0],
    );
  });

  it("throws 404 when the file does not exist", async () => {
    const { ctx, del } = makeDeleteCtx(undefined);

    await expect(new StorageModel(ctx).deleteFile(999)).rejects.toThrow();
    expect(del).not.toHaveBeenCalled();
  });

  it("still removes the row when no storage adapter is configured", async () => {
    const { ctx, del, deleteReturning } = makeDeleteCtx(
      { key: "a/b.png" },
      { storage: undefined },
    );

    await new StorageModel(ctx).deleteFile(1);

    expect(del).not.toHaveBeenCalled();
    expect(deleteReturning).toHaveBeenCalledTimes(1);
  });

  it("deletes when scoped to the owning user", async () => {
    const { ctx, del } = makeDeleteCtx({ key: "a/b.png" });

    await new StorageModel(ctx).deleteFile(1, { ownerId: 7 });

    expect(del).toHaveBeenCalledWith("a/b.png");
  });

  it("throws 404 when the file is not owned by the user", async () => {
    // The scoped delete matches nothing, mirroring a row owned by someone else.
    const { ctx, del } = makeDeleteCtx(undefined);

    await expect(
      new StorageModel(ctx).deleteFile(1, { ownerId: 7 }),
    ).rejects.toThrow();
    expect(del).not.toHaveBeenCalled();
  });

  it("keeps the blob and answers 409 FILE_IN_USE when still referenced", async () => {
    const { ctx, del } = makeDeleteCtx(
      { key: "a/b.png" },
      {
        referenceError: Object.assign(new Error("still referenced"), {
          code: "23503",
        }),
      },
    );

    const error = await new StorageModel(ctx)
      .deleteFile(1)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(HTTPException);
    expect((error as HTTPException).status).toBe(409);
    await expect(
      (error as HTTPException).getResponse().json(),
    ).resolves.toEqual({
      code: STORAGE_FILE_IN_USE,
      content: true,
      id: 1,
      revisions: 0,
    });
    // The whole point: whoever is using this file still has a working file.
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses a file only retained revisions hold, and says how many", async () => {
    // Nothing displays this file any more - the pins are all that is left, and
    // they are exactly what `force` exists to release. Refusing is still the
    // default: the number is what a client needs to say what forcing costs.
    const { ctx, del, rolledBack } = makeDeleteCtx(
      { key: "a/b.png" },
      { pins: 3 },
    );

    const error = await new StorageModel(ctx)
      .deleteFile(1)
      .catch((thrown: unknown) => thrown);

    expect((error as HTTPException).status).toBe(409);
    await expect(
      (error as HTTPException).getResponse().json(),
    ).resolves.toEqual({
      code: STORAGE_FILE_IN_USE,
      content: false,
      id: 1,
      revisions: 3,
    });
    // Rolled back, so the pins the refusal counted are still there.
    expect(rolledBack()).toBe(true);
    expect(del).not.toHaveBeenCalled();
  });

  it("releases the revision pins and deletes the file when forced", async () => {
    const { ctx, del, pinsReturning, rolledBack } = makeDeleteCtx(
      { key: "a/b.png" },
      { pins: 3 },
    );

    await new StorageModel(ctx).deleteFile(1, { force: true });

    expect(pinsReturning).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("a/b.png");
    expect(rolledBack()).toBe(false);
  });

  it("refuses a live content reference even when forced", async () => {
    // There is no version of "delete anyway" that leaves a published page
    // unbroken, so `force` gets past history and nothing else.
    const { ctx, del, rolledBack } = makeDeleteCtx(
      { key: "a/b.png" },
      {
        pins: 2,
        referenceError: Object.assign(new Error("still referenced"), {
          code: "23503",
        }),
      },
    );

    const error = await new StorageModel(ctx)
      .deleteFile(1, { force: true })
      .catch((thrown: unknown) => thrown);

    expect((error as HTTPException).status).toBe(409);
    await expect(
      (error as HTTPException).getResponse().json(),
    ).resolves.toEqual({
      code: STORAGE_FILE_IN_USE,
      content: true,
      id: 1,
      revisions: 2,
    });
    expect(rolledBack()).toBe(true);
    expect(del).not.toHaveBeenCalled();
  });

  it("answers 409 for the Postgres 17 restrict_violation code too", async () => {
    // Postgres 17 reports `23001` where 16 reported `23503` for the same refused
    // delete, so both have to mean "still referenced".
    const { ctx, del } = makeDeleteCtx(
      { key: "a/b.png" },
      {
        referenceError: Object.assign(new Error("restrict"), { code: "23001" }),
      },
    );

    await expect(new StorageModel(ctx).deleteFile(1)).rejects.toMatchObject({
      status: 409,
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("reads the code through a Drizzle wrapper's cause chain", async () => {
    const { ctx } = makeDeleteCtx(
      { key: "a/b.png" },
      {
        referenceError: new Error("Failed query", {
          cause: Object.assign(new Error("still referenced"), {
            code: "23503",
          }),
        }),
      },
    );

    await expect(new StorageModel(ctx).deleteFile(1)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("rethrows a failure that is not a reference violation", async () => {
    const { ctx, del } = makeDeleteCtx(
      { key: "a/b.png" },
      { referenceError: new Error("connection reset") },
    );

    await expect(new StorageModel(ctx).deleteFile(1)).rejects.toThrow(
      "connection reset",
    );
    expect(del).not.toHaveBeenCalled();
  });

  it("keeps the row removed even when the storage delete fails", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("gone"));
    const { ctx, deleteReturning } = makeDeleteCtx(
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
    // The row is already gone, so an unreachable provider leaves an orphaned
    // object rather than a file record nobody can remove.
    expect(deleteReturning).toHaveBeenCalledTimes(1);
  });
});
