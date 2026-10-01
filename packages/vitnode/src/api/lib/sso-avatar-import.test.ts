// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import type { RemoteImage } from "./remote-image";

import { importProviderAvatar, sha256Hex } from "./sso-avatar-import";

const IMAGE: RemoteImage = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  height: 64,
  mimeType: "image/png",
  width: 64,
};

const avatarContext = () => {
  const upload = vi.fn(async (_options: { file: File }) =>
    Promise.resolve({ id: 42, url: "/uploads/avatars/new.png" }),
  );
  const deleteFile = vi.fn(async () => Promise.resolve());
  const emit = vi.fn(async () => Promise.resolve());
  const variables = {
    cache: { deleteSystem: vi.fn(async () => Promise.resolve()) },
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => Promise.resolve([{ fileId: 7 }]),
            then: (onFulfilled: (rows: unknown[]) => unknown) =>
              onFulfilled([]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => Promise.resolve([{ id: 1 }]),
          }),
        }),
      }),
    },
    events: { emit },
    storage: { deleteFile, upload },
  };

  return {
    c: {
      get: (key: keyof typeof variables) => variables[key],
    } as unknown as Context<EnvVitNode>,
    deleteFile,
    emit,
    upload,
  };
};

const URL_A = "https://lh3.googleusercontent.test/a/photo.png";

describe("importing a provider avatar", () => {
  it("does not download again while the imported avatar is still the one shown", async () => {
    const { c, upload } = avatarContext();
    const download = vi.fn(async () => Promise.resolve(IMAGE));

    const outcome = await importProviderAvatar(
      c,
      {
        currentAvatarId: 42,
        maxBytes: 1024,
        previous: { fileId: 42, sha256: "x", sourceUrl: URL_A },
        url: URL_A,
        userId: 1,
      },
      { download },
    );

    expect(outcome).toEqual({ status: "unchanged" });
    expect(download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not store a second copy of the same picture under a new URL", async () => {
    const { c, upload } = avatarContext();

    const outcome = await importProviderAvatar(
      c,
      {
        currentAvatarId: 42,
        maxBytes: 1024,
        previous: {
          fileId: 42,
          sha256: sha256Hex(IMAGE.bytes),
          sourceUrl: "https://lh3.googleusercontent.test/a/old-url.png",
        },
        url: URL_A,
        userId: 1,
      },
      { download: async () => Promise.resolve(IMAGE) },
    );

    expect(outcome).toEqual({ status: "unchanged" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("stores the picture through the avatar pipeline, typed by its content", async () => {
    const { c, deleteFile, emit, upload } = avatarContext();

    const outcome = await importProviderAvatar(
      c,
      {
        currentAvatarId: 7,
        maxBytes: 1024,
        previous: {
          fileId: 42,
          sha256: sha256Hex(IMAGE.bytes),
          sourceUrl: URL_A,
        },
        url: URL_A,
        userId: 1,
      },
      { download: async () => Promise.resolve(IMAGE) },
    );

    expect(outcome).toEqual({
      fileId: 42,
      sha256: sha256Hex(IMAGE.bytes),
      sourceUrl: URL_A,
      status: "updated",
    });
    const stored = upload.mock.calls[0]?.[0];
    expect(stored).toMatchObject({
      folder: "avatars",
      maxBytes: 1024,
      userId: 1,
    });
    expect(stored?.file.type).toBe("image/png");
    expect(deleteFile).toHaveBeenCalledWith(7, { force: true });
    expect(emit).toHaveBeenCalledWith("user.avatar.updated", {
      fileId: 42,
      userId: 1,
    });
  });

  it("leaves the current avatar alone when the download fails", async () => {
    const { c, deleteFile, upload } = avatarContext();

    await expect(
      importProviderAvatar(
        c,
        {
          currentAvatarId: 7,
          maxBytes: 1024,
          previous: { fileId: null, sha256: null, sourceUrl: null },
          url: URL_A,
          userId: 1,
        },
        { download: async () => Promise.reject(new Error("blocked_address")) },
      ),
    ).rejects.toThrow("blocked_address");
    expect(upload).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
