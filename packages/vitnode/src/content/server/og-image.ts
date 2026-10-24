import { createHash } from "node:crypto";

import type { ResolvedOgImagesConfig } from "../../og-image/server/config";
import type { ContentDeliveryOgImageSource } from "../delivery";
import type { ContentId } from "../ids";
import type { RegisteredContentType } from "../registry";
import type { AnyContentTypeDefinition } from "../types";

import { CONFIG } from "../../lib/config";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_MIME_TYPE,
  OG_IMAGE_WIDTH,
} from "../../og-image";
import { ContentEngineError } from "../errors";

/** The generated `og:image` of one record, as delivery metadata reports it. */
export interface ContentDeliveryOgImage {
  alt: null | string;
  height: number;
  type: string;
  /** Absolute. Fetching it renders the card, or serves the cached one. */
  url: string;
  width: number;
}

/**
 * Whether a content type asked for generated images. The install still has to
 * turn them on with `ogImages`.
 */
export const hasContentOgImage = (
  definition: AnyContentTypeDefinition,
): boolean =>
  definition.delivery.enabled &&
  definition.publicApi.enabled &&
  definition.delivery.seo.openGraph?.image != null;

/**
 * Checks, once at startup, that every content type's image template is
 * registered, and warns when a content type wants images the install has
 * not turned on.
 *
 * @throws {ContentEngineError} For a template id `ogImages` does not register.
 */
export const assertContentOgImageTemplates = (
  contentTypes: readonly RegisteredContentType[],
  ogImages: null | ResolvedOgImagesConfig,
): void => {
  const wanting = contentTypes.filter(entry =>
    hasContentOgImage(entry.definition),
  );
  if (wanting.length === 0) return;

  if (!ogImages) {
    // oxlint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33m${wanting.map(entry => entry.definition.id).join(", ")} set delivery.seo.openGraph.image, but buildApiConfig has no \`ogImages\`, so no Open Graph images are generated.\x1b[0m`,
    );

    return;
  }

  for (const { definition } of wanting) {
    const template = definition.delivery.seo.openGraph?.image?.template;
    if (template && !ogImages.templates.has(template)) {
      throw new ContentEngineError(
        `delivery.seo.openGraph.image.template is "${template}", which ogImages.templates does not register (${[...ogImages.templates.keys()].join(", ")}).`,
        { contentTypeId: definition.id },
      );
    }
  }
};

/**
 * The origin the API answers on publicly: `VITNODE_API_URL` when the API
 * runs on its own, else the web origin it is mounted under.
 */
const publicApiOrigin = (): URL =>
  process.env.VITNODE_API_URL ? CONFIG.api : CONFIG.web;

/**
 * The absolute URL of one record's card. `v` changes whenever anything drawn
 * on the card changes, so crawlers that keep images by URL fetch the new one;
 * the route itself ignores it and reads the record again.
 */
export const contentOgImageUrl = ({
  definition,
  itemId,
  locale,
  pluginId,
  version,
}: {
  definition: AnyContentTypeDefinition;
  itemId: ContentId;
  locale: null | string;
  pluginId: string;
  version: string;
}): string => {
  const url = new URL(
    `/api/${pluginId}/content/${definition.publicApi.path}/delivery/og-image/${encodeURIComponent(String(itemId))}`,
    publicApiOrigin(),
  );
  if (locale !== null) url.searchParams.set("locale", locale);
  url.searchParams.set("v", version);

  return url.href;
};

/** A short fingerprint of what a record's card is drawn from. */
export const contentOgImageVersion = ({
  config,
  locale,
  source,
}: {
  config: ResolvedOgImagesConfig;
  locale: null | string;
  source: ContentDeliveryOgImageSource;
}): string => {
  const templateId = source.template ?? config.defaultTemplate;

  return createHash("sha256")
    .update(
      JSON.stringify([
        templateId,
        config.templates.get(templateId)?.version ?? null,
        config.configIdentity,
        locale,
        source.title,
        source.description,
        source.cover?.id ?? null,
        source.cover?.url ?? null,
        source.alt,
      ]),
    )
    .digest("base64url")
    .slice(0, 12);
};

/** The `ogImage` of one record's delivery metadata, or `null` when it has none. */
export const contentDeliveryOgImage = ({
  config,
  definition,
  itemId,
  locale,
  pluginId,
  source,
}: {
  config: null | ResolvedOgImagesConfig;
  definition: AnyContentTypeDefinition;
  itemId: ContentId | null;
  locale: null | string;
  pluginId: string;
  source: ContentDeliveryOgImageSource | null;
}): ContentDeliveryOgImage | null => {
  if (!config || !source || itemId === null) return null;

  return {
    alt: source.alt,
    height: OG_IMAGE_HEIGHT,
    type: OG_IMAGE_MIME_TYPE,
    url: contentOgImageUrl({
      definition,
      itemId,
      locale,
      pluginId,
      version: contentOgImageVersion({ config, locale, source }),
    }),
    width: OG_IMAGE_WIDTH,
  };
};
