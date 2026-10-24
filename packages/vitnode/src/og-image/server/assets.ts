import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { detectImageMimeType } from "@/api/lib/image-signature";
import { downloadRemoteImage, imageDimensions } from "@/api/lib/remote-image";
import { core_files } from "@/database/files";

import type { OgImageBinarySource, OgImageTemplateAsset } from "./types";

import { readBinarySource } from "./fonts";

/** Largest stored or remote image read for a card, in bytes. */
export const OG_IMAGE_ASSET_MAX_BYTES = 10 * 1024 * 1024;

/** Largest decoded image, in pixels - the storage pipeline's own default. */
const OG_IMAGE_ASSET_MAX_PIXELS = 40_000_000;

/** How long reading one image may take before the card renders without it. */
export const OG_IMAGE_ASSET_TIMEOUT_MS = 8000;

/**
 * An image for a card. Prefer `fileId`: it is read through the configured
 * storage adapter, like every other uploaded file.
 */
export type OgImageAssetSource =
  /** Bytes the caller already holds. */
  | { alt?: null | string; bytes: ArrayBuffer | Uint8Array }
  /** A `core_files` id, e.g. a Content Engine `field.file()` value's `id`. */
  | { alt?: null | string; fileId: number }
  /** A public `https` URL, fetched with SSRF checks, a timeout and a size cap. */
  | { alt?: null | string; url: string };

/** A source turned into what the cache key needs now and the bytes it needs later. */
export interface DescribedOgImageAsset {
  /** Stable while the image is the same image. */
  identity: string;
  /** `null` when it cannot be read or is not an image. */
  load: () => Promise<null | OgImageTemplateAsset>;
}

const RASTER_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const sha = (bytes: ArrayBuffer | string | Uint8Array): string =>
  createHash("sha256")
    .update(typeof bytes === "string" ? bytes : new Uint8Array(bytes))
    .digest("base64url");

const withTimeout = async <T>(promise: Promise<T>): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error("Reading an Open Graph image asset timed out."));
      }, OG_IMAGE_ASSET_TIMEOUT_MS).unref();
    }),
  ]);

const isSvg = (bytes: Uint8Array): boolean => {
  const head = new TextDecoder()
    .decode(bytes.subarray(0, 512))
    .trimStart()
    .toLowerCase();

  return head.startsWith("<svg") || head.startsWith("<?xml");
};

/**
 * Decodes, orients and shrinks one image to what a 1200 × 630 card can show,
 * and returns it as a `data:` URI - so the renderer never fetches anything.
 * Raster formats only, unless `allowSvg` (trusted config such as a logo).
 */
export const prepareOgImageAsset = async (
  input: ArrayBuffer | Uint8Array,
  {
    alt = null,
    allowSvg = false,
    box,
    format = "jpeg",
  }: {
    allowSvg?: boolean;
    alt?: null | string;
    /** The largest box the image is shown in, in pixels. */
    box: { height: number; width: number };
    format?: "jpeg" | "png";
  },
): Promise<null | OgImageTemplateAsset> => {
  const bytes = new Uint8Array(input);
  if (bytes.byteLength === 0 || bytes.byteLength > OG_IMAGE_ASSET_MAX_BYTES) {
    return null;
  }

  const type = detectImageMimeType(bytes);
  const svg = type === null && allowSvg && isSvg(bytes);
  if (!svg && (type === null || !RASTER_TYPES.has(type))) return null;

  const sharp = await loadSharp();
  if (!sharp) {
    // The card renders without sharp too, so a missing native build only
    // costs the resize: formats resvg draws go in as they are.
    const passthrough = passThroughAsset(bytes, { alt, svg, type });
    if (passthrough) return passthrough;

    throw new Error(
      "sharp could not be loaded, and the renderer cannot read this image as it is.",
    );
  }

  const pipeline = sharp(bytes, {
    animated: false,
    limitInputPixels: OG_IMAGE_ASSET_MAX_PIXELS,
  })
    .rotate()
    .resize({
      fit: "inside",
      height: box.height * 2,
      width: box.width * 2,
      withoutEnlargement: !svg,
    });
  // PNG keeps a logo's transparency; a cover is a photo, and JPEG is a
  // fraction of the size.
  const { data, info } = await (
    format === "png" ? pipeline.png() : pipeline.jpeg({ quality: 82 })
  ).toBuffer({ resolveWithObject: true });

  return {
    alt,
    height: info.height,
    src: `data:image/${info.format};base64,${data.toString("base64")}`,
    width: info.width,
  };
};

const loadSharp = async () => {
  try {
    return (await import("sharp")).default;
  } catch {
    return null;
  }
};

/** Largest image handed to the renderer without resizing it first. */
const PASSTHROUGH_MAX_BYTES = 4 * 1024 * 1024;

const svgDimensions = (
  bytes: Uint8Array,
): null | { height: number; width: number } => {
  const tag = /<svg[^>]*>/i.exec(new TextDecoder().decode(bytes))?.[0] ?? "";
  const viewBox = /viewBox=["']([^"']+)["']/i
    .exec(tag)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { height: viewBox[3], width: viewBox[2] };
  }

  const width = Number(/\swidth=["']([\d.]+)/i.exec(tag)?.[1]);
  const height = Number(/\sheight=["']([\d.]+)/i.exec(tag)?.[1]);

  return width > 0 && height > 0 ? { height, width } : null;
};

/**
 * The image as it is, for when `sharp` cannot be loaded: PNG, JPEG and SVG up
 * to 4 MB, which resvg decodes itself. `null` for anything else - resvg draws
 * no WebP or AVIF, and an image it cannot draw would leave an empty box.
 */
const passThroughAsset = (
  bytes: Uint8Array,
  { alt, svg, type }: { alt: null | string; svg: boolean; type: null | string },
): null | OgImageTemplateAsset => {
  if (bytes.byteLength > PASSTHROUGH_MAX_BYTES) return null;

  const mimeType = svg ? "image/svg+xml" : type;
  const dimensions = svg
    ? svgDimensions(bytes)
    : mimeType === "image/jpeg" || mimeType === "image/png"
      ? imageDimensions(bytes, mimeType)
      : null;
  if (!mimeType || !dimensions) return null;

  return {
    alt,
    ...dimensions,
    src: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
  };
};

const COVER_BOX = { height: 630, width: 1200 };
const LOGO_BOX = { height: 112, width: 440 };

/**
 * Turns a cover source into a cache identity and a deferred load. A file id is
 * looked up in `core_files` (cheap) so the identity follows the stored object;
 * the bytes are read only when the card is actually rendered.
 */
export const describeOgCover = async (
  c: Context,
  source: OgImageAssetSource,
): Promise<DescribedOgImageAsset | null> => {
  const trimmedAlt = source.alt?.trim() ?? "";
  const alt = trimmedAlt === "" ? null : trimmedAlt;

  if ("bytes" in source) {
    return {
      identity: `bytes:${sha(source.bytes)}`,
      load: async () =>
        await prepareOgImageAsset(source.bytes, { alt, box: COVER_BOX }),
    };
  }

  if ("url" in source) {
    return {
      identity: `url:${source.url}`,
      load: async () => {
        const image = await downloadRemoteImage(source.url, {
          maxBytes: OG_IMAGE_ASSET_MAX_BYTES,
          timeoutMs: OG_IMAGE_ASSET_TIMEOUT_MS,
        });

        return await prepareOgImageAsset(image.bytes, { alt, box: COVER_BOX });
      },
    };
  }

  if (!Number.isSafeInteger(source.fileId) || source.fileId < 1) return null;
  if (!c.get("core").storage?.adapter) return null;

  const [file] = await c
    .get("db")
    .select({ key: core_files.key, size: core_files.size })
    .from(core_files)
    .where(eq(core_files.id, source.fileId))
    .limit(1);
  if (!file || file.size > OG_IMAGE_ASSET_MAX_BYTES) return null;

  return {
    identity: `file:${source.fileId}:${file.key}`,
    load: async () => {
      const bytes = await withTimeout(
        c.get("storage").readBytes(file.key, OG_IMAGE_ASSET_MAX_BYTES),
      );

      return bytes
        ? await prepareOgImageAsset(bytes, { alt, box: COVER_BOX })
        : null;
    },
  };
};

const logos = new Map<string, Promise<null | OgImageTemplateAsset>>();

/**
 * The configured logo, prepared once per process. A URL is fetched with the
 * remote-image limits; bytes and loaders are read as given. A logo that fails
 * to load is left out and tried again on the next render.
 */
export const describeOgLogo = (
  logo: OgImageBinarySource | string | undefined,
): DescribedOgImageAsset | null => {
  if (logo === undefined) return null;

  const identity =
    typeof logo === "string"
      ? `url:${logo}`
      : typeof logo === "function"
        ? "loader"
        : `bytes:${sha(logo)}`;

  return {
    identity,
    load: async () => {
      const cached = logos.get(identity);
      if (cached) return await cached;

      const pending = (async () => {
        const bytes =
          typeof logo === "string"
            ? (
                await downloadRemoteImage(logo, {
                  maxBytes: OG_IMAGE_ASSET_MAX_BYTES,
                  timeoutMs: OG_IMAGE_ASSET_TIMEOUT_MS,
                })
              ).bytes
            : await readBinarySource(logo);

        return await prepareOgImageAsset(bytes, {
          allowSvg: true,
          box: LOGO_BOX,
          format: "png",
        });
      })();
      logos.set(identity, pending);

      try {
        const result = await pending;
        if (result === null) logos.delete(identity);

        return result;
      } catch (error) {
        logos.delete(identity);
        throw error;
      }
    },
  };
};
