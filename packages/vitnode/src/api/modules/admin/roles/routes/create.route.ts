import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";
import {
  EMOJI_ICON_MAX_LENGTH,
  parseEmojiIcon,
  serializeEmojiIcon,
} from "@/lib/emoji-icon";

// Role names are not a column on `core_roles` - every translation lives in
// `core_languages_words`, so the name is the full list of per-language values.
export const zodRoleNameSchema = z
  .array(
    z.object({
      languageCode: z.string(),
      value: z.string().min(1).max(255),
    }),
  )
  .min(1);

// Storage caps are expressed in kB. `null` means unlimited.
export const zodRoleStorageSchema = z.number().int().min(0).nullable();

export const ROLE_IMAGE_SIZE_MAX_KB = 1024 * 1024;
export const zodRoleImageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(ROLE_IMAGE_SIZE_MAX_KB);

export const zodRolePrefixSchema = z.string().max(EMOJI_ICON_MAX_LENGTH);

export const zodCreateRoleAdminSchema = z.object({
  name: zodRoleNameSchema,
  color: z.string().max(50).optional(),
  prefix: zodRolePrefixSchema.optional(),
  allowUploadFiles: z.boolean().optional(),
  totalMaxStorage: zodRoleStorageSchema.optional(),
  maxStorageForSubmit: zodRoleStorageSchema.optional(),
  allowUploadAvatar: z.boolean().optional(),
  allowEditPersonalInfo: z.boolean().optional(),
  maxAvatarSize: zodRoleImageSizeSchema.optional(),
  allowUploadCover: z.boolean().optional(),
  maxCoverSize: zodRoleImageSizeSchema.optional(),
});

export const createRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
      maxAvatarSize,
      allowUploadCover,
      maxCoverSize,
    } = c.req.valid("json");

    const [role] = await c
      .get("db")
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
        ...(maxAvatarSize === undefined ? {} : { maxAvatarSize }),
        ...(allowUploadCover === undefined ? {} : { allowUploadCover }),
        ...(maxCoverSize === undefined ? {} : { maxCoverSize }),
        updatedAt: new Date(),
      })
      .returning({ id: core_roles.id });

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
