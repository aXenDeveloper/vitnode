import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { core_roles } from "@/database/roles";
import { auditDiff } from "@/lib/audit/diff";
import { parseEmojiIcon, serializeEmojiIcon } from "@/lib/emoji-icon";

import {
  zodRoleEditOwnContentMinutesSchema,
  zodRoleImageSizeSchema,
  zodRoleNameSchema,
  zodRolePrefixSchema,
  zodRoleStorageSchema,
} from "../roles.schema";

export const zodCreateRoleAdminSchema = z.object({
  name: zodRoleNameSchema,
  color: z.string().max(50).optional(),
  prefix: zodRolePrefixSchema.optional(),
  allowUploadFiles: z.boolean().optional(),
  totalMaxStorage: zodRoleStorageSchema.optional(),
  maxStorageForSubmit: zodRoleStorageSchema.optional(),
  allowUploadAvatar: z.boolean().optional(),
  allowEditPersonalInfo: z.boolean().optional(),
  allowBrowseAnonymously: z.boolean().optional(),
  forceBrowseAnonymously: z.boolean().optional(),
  allowEditOwnContent: z.boolean().optional(),
  editOwnContentMinutes: zodRoleEditOwnContentMinutesSchema.optional(),
  allowDeleteOwnContent: z.boolean().optional(),
  allowHideOwnContent: z.boolean().optional(),
  maxAvatarSize: zodRoleImageSizeSchema.optional(),
  allowUploadCover: z.boolean().optional(),
  maxCoverSize: zodRoleImageSizeSchema.optional(),
});

export const createRoleAdminRoute = buildRoute({
  adminStaffPermission: { module: "roles", permission: "can_create" },
  route: {
    method: "post",
    description: "Create a new role (Admin only)",
    path: "/create",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodCreateRoleAdminSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Role created",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const {
      name,
      color,
      prefix,
      allowUploadFiles,
      totalMaxStorage,
      maxStorageForSubmit,
      allowUploadAvatar,
      allowEditPersonalInfo,
      allowBrowseAnonymously,
      forceBrowseAnonymously,
      allowEditOwnContent,
      editOwnContentMinutes,
      allowDeleteOwnContent,
      allowHideOwnContent,
      maxAvatarSize,
      allowUploadCover,
      maxCoverSize,
    } = c.req.valid("json");

    const role = await c.get("db").transaction(async tx => {
      const [created] = await tx
        .insert(core_roles)
        .values({
          color: color?.trim() ? color : null,
          prefix: serializeEmojiIcon(parseEmojiIcon(prefix)) || null,
          allowUploadFiles: allowUploadFiles ?? false,
          totalMaxStorage: totalMaxStorage ?? null,
          maxStorageForSubmit: maxStorageForSubmit ?? null,
          ...(allowUploadAvatar === undefined ? {} : { allowUploadAvatar }),
          ...(allowEditPersonalInfo === undefined
            ? {}
            : { allowEditPersonalInfo }),
          ...(allowBrowseAnonymously === undefined
            ? {}
            : { allowBrowseAnonymously }),
          forceBrowseAnonymously: forceBrowseAnonymously ?? false,
          ...(allowEditOwnContent === undefined ? {} : { allowEditOwnContent }),
          editOwnContentMinutes: editOwnContentMinutes ?? null,
          allowDeleteOwnContent: allowDeleteOwnContent ?? false,
          allowHideOwnContent: allowHideOwnContent ?? false,
          ...(maxAvatarSize === undefined ? {} : { maxAvatarSize }),
          ...(allowUploadCover === undefined ? {} : { allowUploadCover }),
          ...(maxCoverSize === undefined ? {} : { maxCoverSize }),
          updatedAt: new Date(),
        })
        .returning();

      await writeAuditLog(
        c,
        {
          action: "role.created",
          changes: auditDiff({
            after: { ...created, name: multiLangAuditLabel(name) },
            before: null,
            exclude: ["createdAt", "id", "updatedAt"],
          }),
          target: {
            id: created.id,
            label: multiLangAuditLabel(name),
            type: "role",
          },
        },
        tx,
      );

      return created;
    });

    await saveLanguageWords(c, {
      pluginCode: "core",
      tableName: "core_roles",
      variable: "name",
      itemId: role.id,
      values: name,
    });

    await c.get("events").emit("role.created", { roleId: role.id });

    return c.json({ id: role.id }, 201);
  },
});
