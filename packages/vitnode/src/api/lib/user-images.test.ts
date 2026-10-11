import type { Context } from "hono";

import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import {
  effectiveUserImagePolicy,
  KILOBYTE,
  notAttachedAsUserImage,
  type RoleImageLimits,
  setUserImage,
  userImageHoldersOf,
} from "./user-images";

const role = (overrides: Partial<RoleImageLimits> = {}): RoleImageLimits => ({
  allowUploadAvatar: true,
  allowUploadCover: true,
  maxAvatarSize: 2048,
  maxCoverSize: 5120,
  ...overrides,
});

describe("effectiveUserImagePolicy", () => {
  it("turns the role's kB caps into bytes", () => {
    expect(effectiveUserImagePolicy([role()])).toEqual({
      avatar: { allowed: true, maxBytes: 2048 * KILOBYTE },
      cover: { allowed: true, maxBytes: 5120 * KILOBYTE },
    });
  });

  it("is allowed as soon as one role allows it, and takes that role's cap", () => {
    const policy = effectiveUserImagePolicy([
      role({ allowUploadAvatar: false, maxAvatarSize: 9999 }),
      role({ maxAvatarSize: 512 }),
    ]);

    expect(policy.avatar).toEqual({ allowed: true, maxBytes: 512 * KILOBYTE });
  });

  it("uses the most generous cap across the allowing roles", () => {
    const policy = effectiveUserImagePolicy([
      role({ maxCoverSize: 1024 }),
      role({ maxCoverSize: 8192 }),
      role({ allowUploadCover: false, maxCoverSize: 99999 }),
    ]);

    expect(policy.cover).toEqual({ allowed: true, maxBytes: 8192 * KILOBYTE });
  });

  it("refuses with a zero cap when no role allows the image", () => {
    const policy = effectiveUserImagePolicy([
      role({ allowUploadAvatar: false }),
      role({ allowUploadAvatar: false }),
    ]);

    expect(policy.avatar).toEqual({ allowed: false, maxBytes: 0 });
  });

  it("still reports the cap for staff when nothing allows it", () => {
    const policy = effectiveUserImagePolicy(
      [role({ allowUploadAvatar: false, maxAvatarSize: 300 })],
      { ignoreAllow: true },
    );

    expect(policy.avatar).toEqual({ allowed: false, maxBytes: 300 * KILOBYTE });
  });

  it("prefers the allowing roles' cap over a refusing role's, even for staff", () => {
    const policy = effectiveUserImagePolicy(
      [
        role({ allowUploadAvatar: false, maxAvatarSize: 99999 }),
        role({ maxAvatarSize: 100 }),
      ],
      { ignoreAllow: true },
    );

    expect(policy.avatar.maxBytes).toBe(100 * KILOBYTE);
  });

  it("treats a user with no roles as unable to upload anything", () => {
    expect(effectiveUserImagePolicy([])).toEqual({
      avatar: { allowed: false, maxBytes: 0 },
      cover: { allowed: false, maxBytes: 0 },
    });
  });
});

describe("userImageHoldersOf", () => {
  it("names the kind each user held the file as", () => {
    expect(
      userImageHoldersOf(
        [
          { avatarId: 5, coverId: null, id: 1 },
          { avatarId: null, coverId: 5, id: 2 },
        ],
        5,
      ),
    ).toEqual([
      { kind: "avatar", userId: 1 },
      { kind: "cover", userId: 2 },
    ]);
  });

  it("lists a user twice when one file is both their avatar and cover", () => {
    expect(userImageHoldersOf([{ avatarId: 5, coverId: 5, id: 1 }], 5)).toEqual(
      [
        { kind: "avatar", userId: 1 },
        { kind: "cover", userId: 1 },
      ],
    );
  });

  it("ignores rows pointing at some other file", () => {
    expect(userImageHoldersOf([{ avatarId: 6, coverId: 7, id: 1 }], 5)).toEqual(
      [],
    );
  });
});

describe("notAttachedAsUserImage", () => {
  it("asks whether a profile still points at the file, not what folder it sits in", () => {
    const { sql } = new PgDialect().sqlToQuery(
      notAttachedAsUserImage(drizzle.mock()),
    );

    expect(sql).toContain("not exists");
    expect(sql).toContain('"core_users"."avatarId" = "core_files"."id"');
    expect(sql).toContain('"core_users"."coverId" = "core_files"."id"');
    expect(sql).not.toContain('"folder"');
  });
});

const uploadContext = (attached: { id: number }[]) => {
  const deleteFile = vi.fn(async () => await Promise.resolve());
  const variables = {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => await Promise.resolve([{ fileId: 7 }]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => await Promise.resolve(attached),
          }),
        }),
      }),
    },
    storage: {
      deleteFile,
      upload: async () =>
        await Promise.resolve({ id: 42, url: "/uploads/avatars/new.png" }),
    },
  };

  return {
    c: {
      get: (key: keyof typeof variables) => variables[key],
    } as unknown as Context<EnvVitNode>,
    deleteFile,
  };
};

const upload = async (c: Context<EnvVitNode>) =>
  await setUserImage(c, {
    file: new File(["x"], "avatar.png", { type: "image/png" }),
    kind: "avatar",
    maxBytes: KILOBYTE,
    userId: 1,
  });

describe("setUserImage", () => {
  it("removes the file it just stored when nothing was there to attach it to", async () => {
    const { c, deleteFile } = uploadContext([]);

    await expect(upload(c)).rejects.toThrow(HTTPException);
    expect(deleteFile).toHaveBeenCalledExactlyOnceWith(42, { force: true });
  });

  it("keeps the previous file when the new one could not be attached", async () => {
    const { c, deleteFile } = uploadContext([]);

    await expect(upload(c)).rejects.toThrow(HTTPException);
    expect(deleteFile).not.toHaveBeenCalledWith(7, { force: true });
  });
});
