import { z } from "@hono/zod-openapi";

import { EMOJI_ICON_MAX_LENGTH } from "@/lib/emoji-icon";
import { ROLE_EDIT_OWN_CONTENT_MAX_MINUTES } from "@/lib/own-content";

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

export const zodRoleEditOwnContentMinutesSchema = z
  .number()
  .int()
  .min(1)
  .max(ROLE_EDIT_OWN_CONTENT_MAX_MINUTES)
  .nullable();
