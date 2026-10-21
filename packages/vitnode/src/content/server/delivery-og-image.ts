import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { ResolvedOgImagesConfig } from "../../og-image/config";
import type { OgImageRenderInput } from "../../og-image/render.server";
import type { ContentId } from "../ids";
import type { ContentLocaleRouting } from "../public-url";
import type { AnyContentTypeDefinition } from "../types";

import { CONFIG } from "../../lib/config";
import {
  OG_IMAGE_NO_STORE,
  ogImageResponse,
  prepareOgImage,
} from "../../og-image/render.server";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
} from "../../og-image/types";
import {
  contentDeliveryOpenGraph,
  contentDeliveryPublicUrl,
  contentDeliverySeo,
} from "../delivery";
import { contentIdKey } from "../ids";
import { contentPublicHref } from "../public-url";

/** The generated Open Graph image of one delivered record, as delivery metadata carries it. */
export interface ContentDeliveryOgImage {
  /** The image's alt text: the Open Graph (else page) title. */
  alt: string;
  height: number;
  /** The API path, `/api/{plugin}/content/{path}/delivery/og-image/{id}?…`. */
  path: string;
  type: string;
  /**
   * The absolute URL: the API origin when `VITNODE_API_URL` is set, else the
   * web origin (`VITNODE_WEB_URL`), which serves the API at `/api`.
   */
  url: string;
  width: number;
}

/** The public fields an image is drawn from, on top of the delivery metadata ones. */
export const contentOgImageFields = (
  definition: AnyContentTypeDefinition,
): string[] => {
  const ogImage = definition.delivery.seo.ogImage;

  return ogImage?.coverField ? [ogImage.coverField] : [];
};

/** Whether `definition` asked for generated images and the API has them on. */
export const contentOgImageEnabled = (
  c: Context,
  definition: AnyContentTypeDefinition,
): boolean =>
  definition.delivery.enabled &&
  definition.delivery.seo.ogImage !== null &&
  !!(c.get("core")?.ogImages as null | ResolvedOgImagesConfig | undefined);

const coverFileId = (value: unknown): null | number => {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "object" || value === null) return null;

  const { id } = value as { id?: unknown };

  return typeof id === "number" && Number.isInteger(id) ? id : null;
};

const canonicalHref = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
  locale: null | string,
  routing: ContentLocaleRouting,
): null | string => {
  const slug = row[definition.publicApi.slugField];
  if (typeof slug !== "string" || slug === "") return null;

  const url = contentDeliveryPublicUrl({ definition, locale, routing, slug });
  if (url === null) return null;
  if (url.origin !== undefined) return contentPublicHref(url);

  try {
    return new URL(url.pathname, CONFIG.web).href;
  } catch {
    return null;
  }
};

/**
 * What the image of one public row is drawn from: the Open Graph title and
 * description (falling back to the SEO ones), the cover field, the language
 * the row was actually served in and its canonical URL.
 */
export const contentOgImageInput = ({
  definition,
  row,
  routing,
}: {
  definition: AnyContentTypeDefinition;
  routing: ContentLocaleRouting;
  row: Record<string, unknown>;
}): OgImageRenderInput => {
  const ogImage = definition.delivery.seo.ogImage;
  const text =
    contentDeliveryOpenGraph(definition, row) ??
    contentDeliverySeo(definition, row);
  const locale =
    definition.localization.enabled && typeof row.locale === "string"
      ? row.locale
      : routing.defaultLocale;
  const fileId = ogImage?.coverField
    ? coverFileId(row[ogImage.coverField])
    : null;

  return {
    cover: fileId === null ? null : { fileId },
    description: text.description,
    locale,
    template: ogImage?.template ?? null,
    title: text.title,
    url: canonicalHref(
      definition,
      row,
      definition.localization.enabled ? locale : null,
      routing,
    ),
  };
};

/** What an image belongs to, in its cache key. The plugin is added by the generator. */
export const contentOgImageIdentity = (
  definition: AnyContentTypeDefinition,
  itemId: ContentId,
): readonly unknown[] => ["content", definition.id, contentIdKey(itemId)];

const apiOrigin = (): URL =>
  process.env.VITNODE_API_URL === undefined ? CONFIG.web : CONFIG.api;

/**
 * The image descriptor for one public row, or `null` when the type has no
 * generated image, `ogImages` is off, or the row has no title. Computes the
 * cache key without drawing anything; its prefix becomes the `v` parameter,
 * so the URL changes whenever the image would, and social networks re-fetch.
 */
export const contentOgImageDescriptor = ({
  c,
  definition,
  itemId,
  pluginId,
  row,
  routing,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  itemId: ContentId;
  pluginId: string;
  routing: ContentLocaleRouting;
  row: Record<string, unknown>;
}): ContentDeliveryOgImage | null => {
  if (!contentOgImageEnabled(c, definition)) return null;

  const input = contentOgImageInput({ definition, row, routing });
  let key: string;
  try {
    key = prepareOgImage(c, input, {
      identity: contentOgImageIdentity(definition, itemId),
    }).key;
  } catch {
    return null;
  }

  const query = new URLSearchParams();
  if (definition.localization.enabled && input.locale) {
    query.set("locale", input.locale);
  }
  query.set("v", key.slice(0, 12));

  const path = `/api/${pluginId}/content/${definition.publicApi.path}/delivery/og-image/${encodeURIComponent(contentIdKey(itemId))}?${query.toString()}`;

  return {
    alt: input.title ?? "",
    height: OG_IMAGE_HEIGHT,
    path,
    type: OG_IMAGE_TYPE,
    url: new URL(path, apiOrigin()).href,
    width: OG_IMAGE_WIDTH,
  };
};

const notFound = (): HTTPException =>
  new HTTPException(404, {
    res: new Response("Not Found", {
      headers: { "Cache-Control": OG_IMAGE_NO_STORE },
      status: 404,
    }),
  });

/**
 * Answers `GET /delivery/og-image/{id}`: reads the record through the public
 * service - the anonymous projection, so drafts, scheduled, hidden, unpublished
 * translations and deleted records are simply not found, whoever asks - and
 * only then returns the cached image or draws it. The check runs on every
 * request, cache hit or not; the `v` parameter is never trusted.
 *
 * @throws `HTTPException(404)` (with `no-store`) when the type has no generated
 * image, `ogImages` is off, or the record is not publicly readable.
 */
export const contentOgImageHandler = async ({
  c,
  definition,
  findPublic,
  itemId,
  locale,
  routing,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  /** The public service's `findById`, narrowed to `select`. */
  findPublic: (
    itemId: ContentId,
    options: { locale?: string; select: string[] },
  ) => Promise<null | Record<string, unknown>>;
  itemId: ContentId;
  locale: string | undefined;
  routing: ContentLocaleRouting;
}): Promise<Response> => {
  if (!contentOgImageEnabled(c, definition)) throw notFound();

  const { seo } = definition.delivery;
  const select = [
    "id",
    definition.publicApi.slugField,
    seo.titleField,
    seo.fallbackTitleField,
    seo.descriptionField,
    seo.fallbackDescriptionField,
    seo.openGraph?.titleField ?? null,
    seo.openGraph?.descriptionField ?? null,
    ...contentOgImageFields(definition),
  ].filter((name): name is string => name !== null);

  const row = await findPublic(itemId, { locale, select });
  if (!row) throw notFound();

  try {
    return await ogImageResponse(c, {
      ...contentOgImageInput({ definition, row, routing }),
      identity: contentOgImageIdentity(definition, itemId),
    });
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw notFound();
    }
    throw error;
  }
};
