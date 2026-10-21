import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { OgImageCoverSource } from "./assets.server";
import type { ResolvedOgImagesConfig } from "./config";
import type { OgImageTemplate, OgImageTemplateInput } from "./types";

import {
  loadOgCover,
  loadOgFonts,
  loadOgLogo,
  ogCoverIdentity,
} from "./assets.server";
import { ogImageCacheKey, rememberOgImage } from "./cache.server";
import { selectOgImageTemplate } from "./config";
import { normalizeOgImageText } from "./input";
import { OG_IMAGE_HEIGHT, OG_IMAGE_TYPE, OG_IMAGE_WIDTH } from "./types";

/**
 * `Cache-Control` of a public image. Short on purpose: an image of a record
 * that stops being public must stop being served, and a copy a CDN or browser
 * already holds cannot be recalled by the API.
 */
export const OG_IMAGE_PUBLIC_CACHE_CONTROL =
  "public, max-age=300, s-maxage=600, stale-while-revalidate=60";

/** `Cache-Control` of an AdminCP preview and of every error. */
export const OG_IMAGE_NO_STORE = "private, no-store";

/** What one image is drawn from. Only ever trusted, server-side data. */
export interface OgImageRenderInput {
  /** Where the cover comes from; `null` draws the template without one. */
  cover?: null | OgImageCoverSource;
  /** Plain text. HTML is not stripped here - pass text. */
  description?: null | string;
  /** The language of the text, e.g. `pl`. Defaults to `en`. */
  locale?: null | string;
  /**
   * A registered template id. Unset, or not registered, means the configured
   * `defaultTemplate`.
   */
  template?: null | string;
  /** Required: an image is not drawn without a title. */
  title: null | string | undefined;
  /** The canonical URL of the page the image is for. */
  url?: null | string;
}

/** Thrown when an image is asked for and `ogImages` is not configured. */
export class OgImagesNotEnabledError extends HTTPException {
  constructor() {
    super(404, { message: "Open Graph images are not enabled." });
  }
}

/** `c.get("core").ogImages`, or a 404 when generated images are off. */
export const requireOgImagesConfig = (c: Context): ResolvedOgImagesConfig => {
  const config = c.get("core")?.ogImages as
    | null
    | ResolvedOgImagesConfig
    | undefined;
  if (!config) throw new OgImagesNotEnabledError();

  return config;
};

const siteNameOf = (c: Context, config: ResolvedOgImagesConfig): string => {
  const metadata = c.get("core")?.metadata;

  return (
    config.branding.siteName ??
    metadata?.shortTitle ??
    metadata?.title ??
    "VitNode"
  );
};

/** One image, prepared: everything needed to look up or draw it. */
export interface PreparedOgImage {
  /** The cache key, also the `ETag`. */
  key: string;
  render: () => Promise<Uint8Array>;
  templateId: string;
}

/**
 * Validates the input, picks the template and computes the cache key, without
 * drawing anything. `identity` names what the image belongs to (for example
 * `["product", 42]`); the plugin, text, cover, template version and
 * configuration version are added to the key here.
 *
 * @throws `HTTPException(404)` when `ogImages` is off or there is no title,
 * and `400` when `strictTemplate` is set and the template is not registered.
 */
export const prepareOgImage = (
  c: Context,
  input: OgImageRenderInput,
  {
    identity,
    strictTemplate = false,
  }: { identity: readonly unknown[]; strictTemplate?: boolean },
): PreparedOgImage => {
  const config = requireOgImagesConfig(c);
  const text = normalizeOgImageText(input);
  if (!text) throw new HTTPException(404, { message: "Nothing to draw." });

  const selected = selectOgImageTemplate(config, input.template, {
    strict: strictTemplate,
  });
  if (!selected) {
    throw new HTTPException(400, { message: "Unknown template." });
  }

  const siteName = siteNameOf(c, config);
  const url = input.url ?? null;
  const key = ogImageCacheKey([
    c.get("plugin")?.id ?? null,
    ...identity,
    text.locale,
    text.title,
    text.description,
    ogCoverIdentity(input.cover),
    url,
    siteName,
    selected.id,
    selected.template.version,
    config.configVersion,
  ]);

  return {
    key,
    render: async () =>
      await renderOgImagePng(c, config, selected.template, {
        ...text,
        cover: input.cover ?? null,
        siteName,
        url,
      }),
    templateId: selected.id,
  };
};

/**
 * Draws one PNG with `@vercel/og`. The renderer is imported on first use, so
 * an API that never draws an image never loads its WebAssembly.
 */
export const renderOgImagePng = async (
  c: Context,
  config: ResolvedOgImagesConfig,
  template: OgImageTemplate,
  input: Omit<OgImageTemplateInput, "colors" | "cover" | "logo"> & {
    cover: null | OgImageCoverSource;
  },
): Promise<Uint8Array> => {
  const [{ ImageResponse }, cover, logo, fonts] = await Promise.all([
    import("@vercel/og"),
    loadOgCover(c, input.cover),
    loadOgLogo(config.branding.logo, config.configVersion),
    loadOgFonts(config.fonts, config.configVersion),
  ]);

  const element = template.render({
    ...input,
    colors: config.branding.colors,
    cover,
    logo,
  });

  const response = new ImageResponse(element, {
    ...(fonts ? { fonts } : {}),
    height: OG_IMAGE_HEIGHT,
    width: OG_IMAGE_WIDTH,
  });
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength === 0) {
    throw new Error("The Open Graph renderer returned an empty image.");
  }

  return data;
};

const matchesEtag = (header: string | undefined, etag: string): boolean =>
  header !== undefined &&
  header.split(",").some(value => value.trim().replace(/^W\//, "") === etag);

/**
 * Answers a request with a generated 1200 × 630 PNG: from the cache when the
 * same image was drawn before, else rendered (once, however many requests
 * arrive together) and cached. Sends `ETag` and answers `304` to a matching
 * `If-None-Match`.
 *
 * Server-only. For a plugin's own Hono route: the plugin reads its data,
 * decides who may see it, and passes trusted text - never request input - to
 * the generator. Check access **before** calling it on every request; a cached
 * image says nothing about who may see it.
 *
 * @throws `HTTPException(404)` when `ogImages` is not configured or there is no title.
 *
 * @example
 * ```ts
 * import { ogImageResponse } from "@vitnode/core/og-image";
 *
 * handler: async c => {
 *   const product = await findPublicProduct(c, c.req.valid("param").id);
 *   if (!product) throw new HTTPException(404);
 *
 *   return await ogImageResponse(c, {
 *     identity: ["product", product.id, product.updatedAt.toISOString()],
 *     title: product.name,
 *     description: product.summary,
 *     cover: product.imageId ? { fileId: product.imageId } : null,
 *   });
 * },
 * ```
 */
export const ogImageResponse = async (
  c: Context,
  {
    cacheControl = OG_IMAGE_PUBLIC_CACHE_CONTROL,
    identity,
    strictTemplate,
    ...input
  }: OgImageRenderInput & {
    /** Defaults to {@link OG_IMAGE_PUBLIC_CACHE_CONTROL}. */
    cacheControl?: string;
    /** What the image belongs to; see {@link prepareOgImage}. */
    identity: readonly unknown[];
    /** Answer `400` for an unregistered template instead of using the default. */
    strictTemplate?: boolean;
  },
): Promise<Response> => {
  const prepared = prepareOgImage(c, input, { identity, strictTemplate });
  const etag = `"og-${prepared.key.slice(0, 32)}"`;
  const headers = {
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };

  if (matchesEtag(c.req.header("if-none-match"), etag)) {
    return new Response(null, { headers, status: 304 });
  }

  const { data, hit } = await rememberOgImage(c, prepared.key, prepared.render);

  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      ...headers,
      "Content-Length": String(data.byteLength),
      "Content-Type": OG_IMAGE_TYPE,
      "X-VitNode-Og-Cache": hit ? "hit" : "miss",
    },
    status: 200,
  });
};
