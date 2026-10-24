import type { Context } from "hono";

import { createHash } from "node:crypto";

import { describeError } from "@/api/lib/error-details";
import { createTaskPool } from "@/lib/task-pool";
import {
  OG_IMAGE_DESCRIPTION_MAX_LENGTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TITLE_MAX_LENGTH,
  OG_IMAGE_WIDTH,
} from "@/og-image";

import type { OgImageAssetSource } from "./assets";
import type { ResolvedOgImagesConfig } from "./config";
import type { OgImageTemplate, OgImageTemplateInput } from "./types";

import { describeOgCover } from "./assets";
import { readOgImageCache, writeOgImageCache } from "./cache";
import { selectOgImageTemplate } from "./config";
import { loadOgImageFonts } from "./fonts";
import { renderOgImagePng } from "./render";

/**
 * What a card is made of. Every value is trusted page data the server read
 * itself - never text or markup straight from a query string.
 */
export interface OgImageRequest {
  /** An optional image for the card: a stored file, a public URL or bytes. */
  cover?: null | OgImageAssetSource;
  /** Plain text, at most 1000 characters. Missing or blank leaves it out. */
  description?: null | string;
  /**
   * Extra parts of the cache key, for a caller whose card depends on more
   * than the values here - e.g. `["@acme/shop", "product", id]`.
   */
  identity?: readonly (number | string)[];
  /** The content's language. Defaults to the install's default locale. */
  locale?: string;
  /** A registered template id. Defaults to `ogImages.defaultTemplate`. */
  template?: null | string;
  /** Plain text, 1-300 characters after trimming. */
  title: string;
  /** The page's canonical `http(s)` URL, which templates may print. */
  url?: null | string;
}

/** A rendered card. */
export interface OgImageResult {
  /** A strong validator for `ETag`, unique to this card's inputs. */
  etag: string;
  /** Whether it came from a cache rather than a render. */
  fromCache: boolean;
  png: Uint8Array;
  templateId: string;
}

/** Thrown for input the generator refuses: empty title, too long, bad URL. */
export class OgImageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OgImageInputError";
  }
}

/** Thrown when the API config has no `ogImages` block. */
export class OgImagesDisabledError extends Error {
  constructor() {
    super(
      "Open Graph images are off. Add `ogImages: {}` to buildApiConfig to turn them on.",
    );
    this.name = "OgImagesDisabledError";
  }
}

const LOCALE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const URL_MAX_LENGTH = 2048;

const text = (value: null | string | undefined): null | string => {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";

  return trimmed === "" ? null : trimmed;
};

const validUrl = (value: null | string | undefined): null | string => {
  if (!value) return null;
  if (value.length > URL_MAX_LENGTH) {
    throw new OgImageInputError("url is too long.");
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new OgImageInputError("url must be http or https.");
    }

    return url.href;
  } catch (error) {
    if (error instanceof OgImageInputError) throw error;
    throw new OgImageInputError("url is not a valid URL.");
  }
};

/** The resolved `ogImages` config, or {@link OgImagesDisabledError}. */
export const requireOgImagesConfig = (c: Context): ResolvedOgImagesConfig => {
  const config = c.get("core").ogImages;
  if (!config) throw new OgImagesDisabledError();

  return config;
};

const toPng = async (
  config: ResolvedOgImagesConfig,
  template: OgImageTemplate,
  input: OgImageTemplateInput,
  fonts: Awaited<ReturnType<typeof loadOgImageFonts>>,
): Promise<Uint8Array> =>
  await renderOgImagePng(await template.render(input), fonts, {
    loadAdditionalAsset: config.loadAdditionalAsset,
  });

/**
 * At most two cards render at once per process: a render is a few hundred
 * milliseconds of CPU, and a burst of first requests for uncached cards must
 * not starve every other request.
 */
const renderPool = createTaskPool(2);

const inPool = async <T>(task: () => Promise<T>): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    renderPool.add(async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });

const inflight = new Map<string, Promise<OgImageResult>>();

/** Logs an image that could not be loaded; the card renders without it. */
const skipAsset =
  (kind: "cover" | "logo") =>
  (error: unknown): undefined => {
    // oxlint-disable-next-line no-console
    console.warn(
      `\x1b[34m[VitNode]\x1b[0m \x1b[33mOpen Graph image ${kind} skipped:\x1b[0m ${describeError(error)}`,
    );

    return undefined;
  };

/**
 * Renders one 1200 × 630 PNG with a registered template, or returns the cached
 * one. The cache key holds every input: the text, the locale, the URL, the
 * cover's stored object, the template id and version, the install's branding
 * and `ogImages.version`, plus `identity`. Concurrent requests for the same
 * key in one process share one render.
 *
 * Authorization is the caller's job and comes first: check that the page is
 * public before calling this, on every request, cached or not.
 *
 * Server-only.
 *
 * @throws {OgImagesDisabledError} Without `ogImages` in the API config.
 * @throws {OgImageInputError} For an empty or too long title or description,
 * a malformed locale or URL.
 * @throws {OgImageTemplateNotFoundError} For an unregistered `template`.
 */
export const generateOgImage = async (
  c: Context,
  request: OgImageRequest,
): Promise<OgImageResult> => {
  const config = requireOgImagesConfig(c);

  const title = text(request.title);
  if (title === null) throw new OgImageInputError("title is required.");
  if ([...title].length > OG_IMAGE_TITLE_MAX_LENGTH) {
    throw new OgImageInputError(
      `title is longer than ${OG_IMAGE_TITLE_MAX_LENGTH} characters.`,
    );
  }

  const description = text(request.description);
  if (
    description !== null &&
    [...description].length > OG_IMAGE_DESCRIPTION_MAX_LENGTH
  ) {
    throw new OgImageInputError(
      `description is longer than ${OG_IMAGE_DESCRIPTION_MAX_LENGTH} characters.`,
    );
  }

  const locale = request.locale ?? c.get("core").i18n.defaultLocale;
  if (!LOCALE_PATTERN.test(locale)) {
    throw new OgImageInputError("locale is not a language tag.");
  }

  const url = validUrl(request.url);
  const { id: templateId, template } = selectOgImageTemplate(
    config,
    request.template,
  );
  const cover = request.cover ? await describeOgCover(c, request.cover) : null;

  const key = createHash("sha256")
    .update(
      JSON.stringify([
        request.identity ?? [],
        templateId,
        template.version,
        config.configIdentity,
        locale,
        title,
        description,
        url,
        cover?.identity ?? null,
        request.cover?.alt ?? null,
      ]),
    )
    .digest("base64url");
  const etag = `"og-${key.slice(0, 32)}"`;
  const cache = c.get("cache");

  const cached = await readOgImageCache(cache, key);
  if (cached) return { etag, fromCache: true, png: cached, templateId };

  const pending = inflight.get(key);
  if (pending) return await pending;

  const rendering = inPool(async (): Promise<OgImageResult> => {
    const [fonts, logo, coverAsset] = await Promise.all([
      loadOgImageFonts(config.fonts),
      config.logo?.load().catch(skipAsset("logo")) ?? null,
      cover?.load().catch(skipAsset("cover")) ?? null,
    ]);

    const png = await toPng(
      config,
      template,
      {
        cover: coverAsset ?? null,
        description,
        height: OG_IMAGE_HEIGHT,
        locale,
        logo: logo ?? null,
        siteName: config.siteName,
        theme: config.theme,
        title,
        url,
        width: OG_IMAGE_WIDTH,
      },
      fonts,
    );

    // An image that failed to load renders the card without it, but that
    // card is not kept: the next request tries the image again.
    if (coverAsset !== undefined && logo !== undefined) {
      await writeOgImageCache(cache, key, png);
    }

    return { etag, fromCache: false, png, templateId };
  });
  inflight.set(key, rendering);

  try {
    return await rendering;
  } finally {
    inflight.delete(key);
  }
};
