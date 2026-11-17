import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { OgImageTemplateImage } from "../../lib/og-image";
import type {
  ContentDeliveryOpenGraphImage,
  ContentDeliverySeo,
} from "../delivery";
import type { ContentFileDescriptor } from "../files";
import type { AnyContentTypeDefinition } from "../types";

import { core_files } from "../../database/files";
import { CONFIG } from "../../lib/config";
import {
  OG_IMAGE_COVER_TYPES,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  ogImageApiUrl,
  ogImageCover,
  ogImageVersion,
} from "../../lib/og-image";
import { resolveContentPublicRowFiles } from "./files";

const asFileId = (value: unknown): null | number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

const altOf = (
  descriptor: ContentFileDescriptor,
  locale: null | string,
  defaultLocale: null | string,
): null | string => {
  const alts = descriptor.alts ?? {};
  for (const code of [locale, defaultLocale]) {
    if (code !== null && alts[code]?.trim()) return alts[code].trim();
  }

  return null;
};

const isDescriptor = (value: unknown): value is ContentFileDescriptor =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "url" in value;

/**
 * The image field as the public reads it. A public read has already resolved
 * the file - with the access rules applied - so its descriptor is reused; a
 * bare id goes through the same pipeline here.
 */
const describe = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
  field: string,
): Promise<ContentFileDescriptor | null> => {
  const value = row[field];
  if (isDescriptor(value)) return value;

  const fileId = asFileId(value);
  if (fileId === null) return null;

  const [described] = await resolveContentPublicRowFiles(c, definition, [
    { id: row.id, [field]: fileId },
  ]);
  const resolved = described?.[field];

  return isDescriptor(resolved) ? resolved : null;
};

/**
 * The record's own `delivery.seo.openGraph.imageField` image, as the public
 * reads it, with its file id: `null` when there is none, or it is restricted
 * by an access rule, has no URL, or is not an image link previews render.
 */
export const contentOwnOgImage = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
  locale: null | string,
): Promise<null | {
  fileId: number;
  image: ContentDeliveryOpenGraphImage;
}> => {
  const field = definition.delivery.seo.openGraph?.imageField ?? null;
  if (field === null) return null;

  const descriptor = await describe(c, definition, row, field);
  if (
    !descriptor ||
    descriptor.restricted ||
    !descriptor.url ||
    !OG_IMAGE_COVER_TYPES.has(descriptor.mimeType ?? "")
  ) {
    return null;
  }

  return {
    fileId: descriptor.id,
    image: {
      alt: altOf(
        descriptor,
        locale,
        definition.localization.enabled
          ? definition.localization.defaultLocale
          : null,
      ),
      generated: false,
      height: descriptor.height ?? null,
      type: descriptor.mimeType,
      url: new URL(descriptor.url, CONFIG.api.origin).href,
      width: descriptor.width ?? null,
    },
  };
};

/**
 * A record's cover as the background of its card: the file's bytes from
 * storage, or `undefined` when it cannot be read. Server-only.
 */
export const contentOgImageCover = async (
  c: Context,
  fileId: number,
): Promise<OgImageTemplateImage | undefined> => {
  const [file] = await c
    .get("db")
    .select({
      key: core_files.key,
      mimeType: core_files.mimeType,
      visibility: core_files.visibility,
    })
    .from(core_files)
    .where(eq(core_files.id, fileId))
    .limit(1);

  return file ? await ogImageCover(c, file) : undefined;
};

/** The URL version of a record's card: changes exactly when its picture would, its cover included. */
export const contentOgImageVersion = (
  c: Context,
  definition: AnyContentTypeDefinition,
  {
    coverId,
    locale,
    text,
  }: {
    coverId: null | number;
    locale: null | string;
    text: ContentDeliverySeo;
  },
): string =>
  ogImageVersion(c, [
    definition.id,
    text.title,
    text.description,
    locale,
    coverId,
  ]);

/** Whether a content type draws cards on this install. */
export const contentOgImageEnabled = (
  c: Context,
  definition: AnyContentTypeDefinition,
): boolean =>
  definition.delivery.seo.openGraph?.generateImage === true &&
  c.get("core").ogImage.enabled;

/**
 * The generated card of one record: its absolute, versioned URL on
 * `/delivery/og/{slug}`, or `null` when cards are off for the type or install.
 * Keyed by slug, which delivery always has, rather than by an id the public
 * projection may withhold.
 */
export const contentGeneratedOgImage = (
  c: Context,
  definition: AnyContentTypeDefinition,
  {
    coverId,
    locale,
    pluginId,
    slug,
    text,
  }: {
    /** The `imageField` file drawn behind the card, so a new cover is a new URL. */
    coverId: null | number;
    locale: null | string;
    pluginId: string;
    slug: string;
    text: ContentDeliverySeo;
  },
): ContentDeliveryOpenGraphImage | null => {
  if (!contentOgImageEnabled(c, definition)) return null;

  return {
    alt: text.title,
    generated: true,
    height: OG_IMAGE_HEIGHT,
    type: OG_IMAGE_TYPE,
    url: ogImageApiUrl(
      `/${pluginId}/content/${definition.publicApi.path}/delivery/og/${encodeURIComponent(slug)}`,
      {
        locale,
        v: contentOgImageVersion(c, definition, { coverId, locale, text }),
      },
    ),
    width: OG_IMAGE_WIDTH,
  };
};
