import { z } from "@hono/zod-openapi";

import {
  EMOJI_ICON_MAX_LENGTH,
  parseEmojiIcon,
  serializeEmojiIcon,
} from "@/lib/emoji-icon";
import {
  NAVIGATION_DESCRIPTION_MAX_LENGTH,
  NAVIGATION_HREF_MAX_LENGTH,
  NAVIGATION_KINDS,
  NAVIGATION_PRESET_ID_MAX_LENGTH,
  NAVIGATION_TITLE_MAX_LENGTH,
} from "@/lib/navigation";

const navigationTextSchema = (maxLength: number) =>
  z.array(
    z.object({
      languageCode: z.string().min(1).max(32),
      value: z.string().max(maxLength),
    }),
  );

export const zodNavigationIdSchema = z.number().int().positive();

export const zodNavigationTitleSchema = navigationTextSchema(
  NAVIGATION_TITLE_MAX_LENGTH,
);

export const zodNavigationDescriptionSchema = navigationTextSchema(
  NAVIGATION_DESCRIPTION_MAX_LENGTH,
);

export const zodNavigationHrefSchema = z
  .string()
  .min(1)
  .max(NAVIGATION_HREF_MAX_LENGTH);

export const zodNavigationIconSchema = z.string().max(EMOJI_ICON_MAX_LENGTH);

export const zodNavigationPresetSchema = z.object({
  href: z.string(),
  icon: z.string().nullable(),
  id: z.string(),
  isOpenInNewTab: z.boolean(),
  pluginId: z.string(),
});

export const zodPublicNavigationItemSchema = z.object({
  id: z.number(),
  kind: z.enum(NAVIGATION_KINDS),
  pluginId: z.string().nullable(),
  presetId: z.string().nullable(),
  href: z.string(),
  icon: z.string().nullable(),
  isOpenInNewTab: z.boolean(),
  title: zodNavigationTitleSchema,
  description: zodNavigationDescriptionSchema,
});

export const zodPublicNavigationNodeSchema =
  zodPublicNavigationItemSchema.extend({
    items: z.array(zodPublicNavigationItemSchema),
  });

export const zodAdminNavigationItemSchema = z.object({
  id: z.number(),
  parentId: z.number().nullable(),
  kind: z.enum(NAVIGATION_KINDS),
  pluginId: z.string().nullable(),
  presetId: z.string().nullable(),
  href: z.string().nullable(),
  icon: z.string().nullable(),
  isOpenInNewTab: z.boolean(),
  position: z.number(),
  title: zodNavigationTitleSchema,
  description: zodNavigationDescriptionSchema,
  preset: zodNavigationPresetSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * An icon on the way in: the same `icon:name` value a role prefix holds.
 *
 * Emoji are refused rather than stored - the menu offers the icon half of the
 * picker only, and a payload saying otherwise is not a menu this API writes.
 */
export const normalizeNavigationIcon = (
  icon: null | string | undefined,
): { ok: false } | { ok: true; value: null | string } => {
  if (icon === undefined) return { ok: true, value: null };

  const trimmed = icon?.trim() ?? "";
  if (trimmed === "") return { ok: true, value: null };

  const parsed = parseEmojiIcon(trimmed);

  return parsed?.type === "icon"
    ? { ok: true, value: serializeEmojiIcon(parsed) }
    : { ok: false };
};

export const hasNavigationText = (
  values: readonly { value: string }[] | undefined,
): boolean => (values ?? []).some(item => item.value.trim().length > 0);

const sharedCreateFields = {
  description: zodNavigationDescriptionSchema.optional(),
  icon: zodNavigationIconSchema.nullable().optional(),
  isOpenInNewTab: z.boolean().optional(),
  parentId: zodNavigationIdSchema.nullable().optional(),
};

export const zodCreateNavigationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("preset"),
    pluginId: z.string().min(1).max(50),
    presetId: z.string().min(1).max(NAVIGATION_PRESET_ID_MAX_LENGTH),
    title: zodNavigationTitleSchema.optional(),
    ...sharedCreateFields,
  }),
  z.object({
    kind: z.literal("custom"),
    href: zodNavigationHrefSchema,
    title: zodNavigationTitleSchema.min(1),
    ...sharedCreateFields,
  }),
]);

export const zodUpdateNavigationSchema = z
  .object({
    href: zodNavigationHrefSchema,
    title: zodNavigationTitleSchema,
    description: zodNavigationDescriptionSchema,
    icon: zodNavigationIconSchema.nullable(),
    isOpenInNewTab: z.boolean(),
    parentId: zodNavigationIdSchema.nullable(),
  })
  .partial()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: "At least one field is required",
  });

export const zodReorderNavigationSchema = z.object({
  items: z
    .array(
      z.object({
        id: zodNavigationIdSchema,
        children: z.array(zodNavigationIdSchema),
      }),
    )
    .min(1),
});
