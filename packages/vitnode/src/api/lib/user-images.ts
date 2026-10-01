import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq, inArray, notExists, or, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { invalidateSessionCacheForUser } from "@/api/models/session-revoke";
import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  USER_IMAGE_FOLDERS,
  USER_IMAGE_KINDS,
  USER_IMAGE_MIME_TYPES,
  type UserImageKind,
  type UserImagePolicy,
} from "@/lib/user-images";

import { getUserRoleIds } from "./check-staff-permission";
import { storageUrlOf } from "./storage-url";

export {
  storageUrlOf,
  USER_IMAGE_FOLDERS,
  USER_IMAGE_KINDS,
  USER_IMAGE_MIME_TYPES,
  type UserImageKind,
  type UserImagePolicy,
};

export const zodUserImageKind = z.enum(USER_IMAGE_KINDS);

export const zodUserImageLimit = z.object({
  allowed: z.boolean(),
  maxBytes: z.number(),
});

export const zodUserImagePolicy = z.object({
  avatar: zodUserImageLimit,
  cover: zodUserImageLimit,
});

export const KILOBYTE = 1024;

export interface RoleImageLimits {
  allowUploadAvatar: boolean;
  allowUploadCover: boolean;
  maxAvatarSize: number;
  maxCoverSize: number;
}

const kilobytesToBytes = (kilobytes: number): number => kilobytes * KILOBYTE;

const limitFor = (
  roles: RoleImageLimits[],
  kind: UserImageKind,
  ignoreAllow: boolean,
): UserImagePolicy[UserImageKind] => {
  const allowKey = kind === "avatar" ? "allowUploadAvatar" : "allowUploadCover";
  const sizeKey = kind === "avatar" ? "maxAvatarSize" : "maxCoverSize";

  const allowing = roles.filter(role => role[allowKey]);
  const counted = ignoreAllow && allowing.length === 0 ? roles : allowing;

  return {
    allowed: allowing.length > 0,
    maxBytes: kilobytesToBytes(
      counted.reduce((max, role) => Math.max(max, role[sizeKey]), 0),
    ),
  };
};

export const effectiveUserImagePolicy = (
  roles: RoleImageLimits[],
  { ignoreAllow = false }: { ignoreAllow?: boolean } = {},
): UserImagePolicy => ({
  avatar: limitFor(roles, "avatar", ignoreAllow),
  cover: limitFor(roles, "cover", ignoreAllow),
});

export const resolveUserImagePolicy = async (
  c: Context<EnvVitNode>,
  user: { id: number; roleId: number },
  options: { ignoreAllow?: boolean } = {},
): Promise<UserImagePolicy> => {
  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({
      allowUploadAvatar: core_roles.allowUploadAvatar,
      allowUploadCover: core_roles.allowUploadCover,
      maxAvatarSize: core_roles.maxAvatarSize,
      maxCoverSize: core_roles.maxCoverSize,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return effectiveUserImagePolicy(roles, options);
};

const imageColumn = (kind: UserImageKind) =>
  kind === "avatar" ? core_users.avatarId : core_users.coverId;

const currentImageId = async (
  c: Context<EnvVitNode>,
  userId: number,
  kind: UserImageKind,
): Promise<null | number> => {
  const [row] = await c
    .get("db")
    .select({ fileId: imageColumn(kind) })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  return row?.fileId ?? null;
};

const discardFile = async (
  c: Context<EnvVitNode>,
  fileId: null | number,
): Promise<void> => {
  if (fileId === null) return;

  try {
    await c.get("storage").deleteFile(fileId, { force: true });
  } catch (error) {
    if (error instanceof HTTPException) return;

    throw error;
  }
};

const afterImageChange = async (
  c: Context,
  {
    fileId,
    kind,
    userId,
  }: { fileId: null | number; kind: UserImageKind; userId: number },
): Promise<void> => {
  await invalidateSessionCacheForUser(c, userId);
  await c
    .get("events")
    .emit(kind === "avatar" ? "user.avatar.updated" : "user.cover.updated", {
      fileId,
      userId,
    });
};

export interface UserImageHolder {
  kind: UserImageKind;
  userId: number;
}

export interface UserImageHolderRow {
  avatarId: null | number;
  coverId: null | number;
  id: number;
}

export const userImageHoldersOf = (
  rows: UserImageHolderRow[],
  fileId: number,
): UserImageHolder[] =>
  rows.flatMap(row => [
    ...(row.avatarId === fileId
      ? [{ kind: "avatar" as const, userId: row.id }]
      : []),
    ...(row.coverId === fileId
      ? [{ kind: "cover" as const, userId: row.id }]
      : []),
  ]);

export const findUserImageHolders = async (
  db: Pick<EnvVitNode["Variables"]["db"], "select">,
  fileId: number,
): Promise<UserImageHolder[]> => {
  const rows = await db
    .select({
      id: core_users.id,
      avatarId: core_users.avatarId,
      coverId: core_users.coverId,
    })
    .from(core_users)
    .where(or(eq(core_users.avatarId, fileId), eq(core_users.coverId, fileId)));

  return userImageHoldersOf(rows, fileId);
};

export const notAttachedAsUserImage = (
  db: Pick<EnvVitNode["Variables"]["db"], "select">,
): SQL =>
  notExists(
    db
      .select({ one: sql`1` })
      .from(core_users)
      .where(
        or(
          eq(core_users.avatarId, core_files.id),
          eq(core_users.coverId, core_files.id),
        ),
      ),
  );

export const releaseUserImageHolders = async (
  c: Context,
  holders: UserImageHolder[],
): Promise<void> => {
  for (const { kind, userId } of holders) {
    await afterImageChange(c, { fileId: null, kind, userId });
  }
};

export const setUserImage = async (
  c: Context<EnvVitNode>,
  {
    file,
    kind,
    maxBytes,
    userId,
  }: { file: File; kind: UserImageKind; maxBytes: number; userId: number },
): Promise<{ id: number; url: string }> => {
  const previousId = await currentImageId(c, userId, kind);

  const stored = await c.get("storage").upload({
    allowedMimeTypes: [...USER_IMAGE_MIME_TYPES],
    file,
    folder: USER_IMAGE_FOLDERS[kind],
    maxBytes,
    metadata: { kind, userId },
    userId,
  });

  try {
    const [attached] = await c
      .get("db")
      .update(core_users)
      .set(kind === "avatar" ? { avatarId: stored.id } : { coverId: stored.id })
      .where(eq(core_users.id, userId))
      .returning({ id: core_users.id });

    if (!attached) {
      throw new HTTPException(404, { message: "User not found" });
    }
  } catch (error) {
    await discardFile(c, stored.id).catch(() => undefined);

    throw error;
  }

  await discardFile(c, previousId === stored.id ? null : previousId);
  await afterImageChange(c, { fileId: stored.id, kind, userId });

  return { id: stored.id, url: stored.url };
};

export const removeUserImage = async (
  c: Context<EnvVitNode>,
  { kind, userId }: { kind: UserImageKind; userId: number },
): Promise<void> => {
  const previousId = await currentImageId(c, userId, kind);

  await c
    .get("db")
    .update(core_users)
    .set(kind === "avatar" ? { avatarId: null } : { coverId: null })
    .where(eq(core_users.id, userId));

  await discardFile(c, previousId);
  await afterImageChange(c, { fileId: null, kind, userId });
};
