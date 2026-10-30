import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import { multiLangAuditLabel, roleAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { invalidateAllStaffPermissions } from "@/api/lib/staff-permission-cache";
import { core_roles } from "@/database/roles";
import { auditDiff } from "@/lib/audit/diff";
import { parseEmojiIcon, serializeEmojiIcon } from "@/lib/emoji-icon";

import { assertCanManageAdminRole } from "../lib/assert-manage-admin-role";
import {
  zodRoleEditOwnContentMinutesSchema,
  zodRoleImageSizeSchema,
  zodRoleNameSchema,
  zodRolePrefixSchema,
  zodRoleStorageSchema,
} from "./create.route";

export const zodUpdateRoleAdminSchema = z
  .object({
    name: zodRoleNameSchema,
    color: z.string().max(50),
    prefix: zodRolePrefixSchema,
    allowUploadFiles: z.boolean(),
    totalMaxStorage: zodRoleStorageSchema,
    maxStorageForSubmit: zodRoleStorageSchema,
    allowUploadAvatar: z.boolean(),
    allowEditPersonalInfo: z.boolean(),
    allowBrowseAnonymously: z.boolean(),
    forceBrowseAnonymously: z.boolean(),
    allowEditOwnContent: z.boolean(),
    editOwnContentMinutes: zodRoleEditOwnContentMinutesSchema,
    allowDeleteOwnContent: z.boolean(),
    allowHideOwnContent: z.boolean(),
    maxAvatarSize: zodRoleImageSizeSchema,
    allowUploadCover: z.boolean(),
    maxCoverSize: zodRoleImageSizeSchema,
  })
  .partial()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: "At least one field is required",
  });

export const updateRoleAdminRoute = buildRoute({
  adminStaffPermission: { module: "roles", permission: "can_edit" },
  route: {
    method: "patch",
    description: "Update a role by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodUpdateRoleAdminSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Role updated",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Role not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return c.json({ error: "Role not found" }, 404);
    }

    const [role] = await db
      .select()
      .from(core_roles)
      .where(eq(core_roles.id, roleId))
      .limit(1);

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    // Editing a role that grants admin access requires the elevated permission.
    await assertCanManageAdminRole(c, { roleId, permission: "can_edit_admin" });

    const values: Partial<typeof core_roles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.color !== undefined) {
      values.color = body.color.trim() ? body.color : null;
    }
    if (body.prefix !== undefined) {
      values.prefix = serializeEmojiIcon(parseEmojiIcon(body.prefix)) || null;
    }
    if (body.allowUploadFiles !== undefined) {
      values.allowUploadFiles = body.allowUploadFiles;
    }
    // `null` is a meaningful value here (unlimited), so only skip `undefined`.
    if (body.totalMaxStorage !== undefined) {
      values.totalMaxStorage = body.totalMaxStorage;
    }
    if (body.maxStorageForSubmit !== undefined) {
      values.maxStorageForSubmit = body.maxStorageForSubmit;
    }
    if (body.allowEditPersonalInfo !== undefined) {
      values.allowEditPersonalInfo = body.allowEditPersonalInfo;
    }
    if (body.allowBrowseAnonymously !== undefined) {
      values.allowBrowseAnonymously = body.allowBrowseAnonymously;
    }
    if (body.forceBrowseAnonymously !== undefined) {
      values.forceBrowseAnonymously = body.forceBrowseAnonymously;
    }
    if (body.allowEditOwnContent !== undefined) {
      values.allowEditOwnContent = body.allowEditOwnContent;
    }
    if (body.editOwnContentMinutes !== undefined) {
      values.editOwnContentMinutes = body.editOwnContentMinutes;
    }
    if (body.allowDeleteOwnContent !== undefined) {
      values.allowDeleteOwnContent = body.allowDeleteOwnContent;
    }
    if (body.allowHideOwnContent !== undefined) {
      values.allowHideOwnContent = body.allowHideOwnContent;
    }

    if (body.allowUploadAvatar !== undefined) {
      values.allowUploadAvatar = body.allowUploadAvatar;
    }
    if (body.maxAvatarSize !== undefined) {
      values.maxAvatarSize = body.maxAvatarSize;
    }
    if (body.allowUploadCover !== undefined) {
      values.allowUploadCover = body.allowUploadCover;
    }
    if (body.maxCoverSize !== undefined) {
      values.maxCoverSize = body.maxCoverSize;
    }

    const label = await roleAuditLabel(c, roleId);
    const renamed =
      body.name === undefined ? label : multiLangAuditLabel(body.name);

    await db.transaction(async tx => {
      await tx.update(core_roles).set(values).where(eq(core_roles.id, roleId));

      const changes = auditDiff({
        after: { ...role, ...values, name: renamed },
        before: { ...role, name: label },
        exclude: ["createdAt", "id", "updatedAt"],
      });
      if (changes) {
        await writeAuditLog(
          c,
          {
            action: "role.updated",
            changes,
            target: { id: roleId, label: renamed, type: "role" },
          },
          tx,
        );
      }
    });

    if (body.name !== undefined) {
      await saveLanguageWords(c, {
        pluginCode: "core",
        tableName: "core_roles",
        variable: "name",
        itemId: roleId,
        values: body.name,
      });
    }

    // `root` is part of every permission resolution, so an edit here can change
    // the answer for every member of this role at once.
    await invalidateAllStaffPermissions(c);

    await c.get("events").emit("role.updated", { roleId });

    return c.json({ id: roleId }, 200);
  },
});
