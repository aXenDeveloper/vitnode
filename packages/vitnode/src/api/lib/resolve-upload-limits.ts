import type { Context } from "hono";

import { eq, inArray, sql } from "drizzle-orm";

import type { UploadLimits } from "@/lib/upload-limits";

import { core_files } from "@/database/files";
import { core_roles } from "@/database/roles";
import {
  DEFAULT_UPLOAD_FOLDER,
  DEFAULT_UPLOAD_MAX_FILES,
  DEFAULT_UPLOAD_MIME_TYPES,
  mergeRoleUploadLimits,
  UNLIMITED_UPLOADS,
} from "@/lib/upload-limits";

import { getUserRoleIds } from "./check-staff-permission";

export interface ResolvedUploadLimits extends UploadLimits {
  /** What the user already stores, so a quota can be turned into "space left". */
  usedBytes: number;
}

/**
 * What this user is allowed to upload right now: the merged caps of their roles
 * plus the space their existing files take.
 *
 * A `root` role is unlimited, exactly as it bypasses staff permissions - being
 * root and being unable to attach a file would be a surprising combination.
 */
export const resolveUploadLimits = async (
  c: Context,
  user: { id: number; roleId: number },
): Promise<ResolvedUploadLimits> => {
  const db = c.get("db");
  const roleIds = await getUserRoleIds(c, user);

  const [roles, [usage]] = await Promise.all([
    db
      .select({
        allowUploadFiles: core_roles.allowUploadFiles,
        maxStorageForSubmit: core_roles.maxStorageForSubmit,
        root: core_roles.root,
        totalMaxStorage: core_roles.totalMaxStorage,
      })
      .from(core_roles)
      .where(inArray(core_roles.id, roleIds)),
    db
      .select({ used: sql<number>`coalesce(sum(${core_files.size}), 0)::int` })
      .from(core_files)
      .where(eq(core_files.userId, user.id)),
  ]);

  const limits = roles.some(role => role.root)
    ? UNLIMITED_UPLOADS
    : mergeRoleUploadLimits(roles);

  return { ...limits, usedBytes: usage?.used ?? 0 };
};

export interface UploadRules {
  allowedMimeTypes: string[];
  folder: string;
  maxFiles: number;
}

/** The app's `storage.uploads` config, with the core defaults filled in. */
export const resolveUploadRules = (c: Context): UploadRules => {
  const uploads = c.get("core").storage?.uploads;

  return {
    allowedMimeTypes: uploads?.allowedMimeTypes ?? DEFAULT_UPLOAD_MIME_TYPES,
    folder: uploads?.folder ?? DEFAULT_UPLOAD_FOLDER,
    maxFiles: uploads?.maxFiles ?? DEFAULT_UPLOAD_MAX_FILES,
  };
};
