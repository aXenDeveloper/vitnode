import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { OgImageAsset, OgImageBranding, OgImageFont } from "./types";

import {
  downloadRemoteImage,
  REMOTE_IMAGE_MAX_BYTES,
} from "../api/lib/remote-image";
import { core_files } from "../database/files";

/** Largest image the generator reads, from storage, a URL or an upload. */
export const OG_IMAGE_ASSET_MAX_BYTES = REMOTE_IMAGE_MAX_BYTES;
/** How long reading one stored or remote image may take. */
export const OG_IMAGE_ASSET_TIMEOUT_MS = 8000;

const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Where a cover image comes from. Every source is size-capped at
 * {@link OG_IMAGE_ASSET_MAX_BYTES} and time-boxed at
 * {@link OG_IMAGE_ASSET_TIMEOUT_MS}.
 *
 * - `fileId`: a `core_files` row (a Content Engine file field), read through
 *   the configured storage adapter.
 * - `url`: a public `https://` URL, downloaded with private-address and
 *   redirect checks.
 * - `bytes`: image bytes the caller already holds.
 */
export type OgImageCoverSource =
  | { bytes: Uint8Array }
  | { fileId: number }
  | { url: string };

/** The fingerprint of a cover source, for cache keys - never its bytes. */
export const ogCoverIdentity = (
  source: null | OgImageCoverSource | undefined,
): null | string => {
  if (!source) return null;
  if ("fileId" in source) return `file:${source.fileId}`;
  if ("url" in source) return `url:${source.url}`;

  return `bytes:${source.bytes.byteLength}`;
};

class OgAssetTimeout extends Error {}

const withTimeout = async <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new OgAssetTimeout()), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Re-encodes an image with `sharp` into something the renderer reads (PNG for
 * transparency, JPEG otherwise), shrunk to fit `box`. Satori draws neither
 * WebP nor AVIF, which is what VitNode stores uploads as.
 */
const toAsset = async (
  bytes: Uint8Array,
  box: { height: number; width: number },
  format: "jpeg" | "png",
): Promise<null | OgImageAsset> => {
  try {
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(bytes, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({ ...box, fit: "inside", withoutEnlargement: true })
      [format](format === "jpeg" ? { quality: 82 } : {})
      .toBuffer({ resolveWithObject: true });

    return {
      height: info.height,
      src: `data:image/${format};base64,${data.toString("base64")}`,
      width: info.width,
    };
  } catch {
    return null;
  }
};

const readStoredFile = async (
  c: Context,
  fileId: number,
): Promise<null | Uint8Array> => {
  if (!c.get("core")?.storage?.adapter) return null;

  const [file] = await c
    .get("db")
    .select({ key: core_files.key, mimeType: core_files.mimeType })
    .from(core_files)
    .where(eq(core_files.id, fileId))
    .limit(1);
  if (!file?.mimeType?.startsWith("image/")) return null;

  return await c.get("storage").readBytes(file.key, OG_IMAGE_ASSET_MAX_BYTES);
};

const readCoverBytes = async (
  c: Context,
  source: OgImageCoverSource,
): Promise<null | Uint8Array> => {
  if ("bytes" in source) {
    return source.bytes.byteLength <= OG_IMAGE_ASSET_MAX_BYTES
      ? source.bytes
      : null;
  }
  if ("fileId" in source) return await readStoredFile(c, source.fileId);

  const image = await downloadRemoteImage(source.url, {
    maxBytes: OG_IMAGE_ASSET_MAX_BYTES,
    timeoutMs: OG_IMAGE_ASSET_TIMEOUT_MS,
  });

  return image.bytes;
};

/**
 * Loads and converts a cover image. Any failure - a missing file, a timeout, a
 * blocked URL, bytes that are not an image - yields `null`, so the image is
 * drawn without a cover rather than not at all.
 */
export const loadOgCover = async (
  c: Context,
  source: null | OgImageCoverSource | undefined,
): Promise<null | OgImageAsset> => {
  if (!source) return null;

  try {
    const bytes = await withTimeout(
      readCoverBytes(c, source),
      OG_IMAGE_ASSET_TIMEOUT_MS,
    );

    return bytes
      ? await toAsset(bytes, { height: 1260, width: 1200 }, "jpeg")
      : null;
  } catch {
    return null;
  }
};

const logoCache = new Map<string, Promise<null | OgImageAsset>>();

const readLogoBytes = async (
  logo: NonNullable<OgImageBranding["logo"]>,
): Promise<null | Uint8Array> => {
  if (typeof logo === "function") return await logo();

  if (logo.startsWith("data:")) {
    const comma = logo.indexOf(",");
    if (comma < 0) return null;
    const payload = logo.slice(comma + 1);

    return logo.slice(0, comma).endsWith(";base64")
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload));
  }

  return (
    await downloadRemoteImage(logo, {
      maxBytes: OG_IMAGE_ASSET_MAX_BYTES,
      timeoutMs: OG_IMAGE_ASSET_TIMEOUT_MS,
    })
  ).bytes;
};

/**
 * The configured logo as a PNG asset, loaded once per process and per
 * configuration. A logo that fails to load is drawn as no logo, and retried on
 * the next request.
 */
export const loadOgLogo = async (
  logo: OgImageBranding["logo"],
  configVersion: string,
): Promise<null | OgImageAsset> => {
  if (!logo) return null;

  const cached = logoCache.get(configVersion);
  if (cached) return await cached;

  const loading = (async () => {
    const bytes = await withTimeout(
      readLogoBytes(logo),
      OG_IMAGE_ASSET_TIMEOUT_MS,
    );
    if (!bytes || bytes.byteLength > OG_IMAGE_ASSET_MAX_BYTES) return null;

    return await toAsset(bytes, { height: 160, width: 640 }, "png");
  })().catch(() => null);

  logoCache.set(configVersion, loading);
  const asset = await loading;
  if (asset === null) logoCache.delete(configVersion);

  return asset;
};

/** What `@vercel/og` takes in `fonts`. */
export interface LoadedOgFont {
  data: ArrayBuffer;
  name: string;
  style: "italic" | "normal";
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
}

const toArrayBuffer = (data: ArrayBuffer | Uint8Array): ArrayBuffer =>
  data instanceof ArrayBuffer
    ? data
    : (data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer);

const loadFont = async (font: OgImageFont): Promise<LoadedOgFont> => {
  const data = typeof font.data === "function" ? await font.data() : font.data;

  return {
    data: toArrayBuffer(data),
    name: font.name,
    style: font.style ?? "normal",
    weight: font.weight ?? 400,
  };
};

/**
 * Geist Regular as `@vercel/og` ships it, next to its entry file. Passing
 * `fonts` replaces the renderer's default font, so it is read here and
 * appended as the last fallback. `null` when the file cannot be found - a
 * bundler that inlined the package - and the configured fonts then stand alone.
 */
const loadBundledFont = async (): Promise<LoadedOgFont | null> => {
  try {
    const entry = createRequire(import.meta.url).resolve("@vercel/og");
    const data = await readFile(join(dirname(entry), "Geist-Regular.ttf"));

    return {
      data: toArrayBuffer(data),
      name: "Geist",
      style: "normal",
      weight: 400,
    };
  } catch {
    return null;
  }
};

let bundledFont: Promise<LoadedOgFont | null> | undefined;
const fontCache = new Map<string, Promise<LoadedOgFont[]>>();

/**
 * The configured fonts followed by the bundled Geist Regular, read once per
 * process and per configuration and reused for every image. `undefined`
 * without configured fonts, which leaves `@vercel/og` on its own default
 * (the same Geist Regular).
 */
export const loadOgFonts = async (
  fonts: OgImageFont[],
  configVersion: string,
): Promise<LoadedOgFont[] | undefined> => {
  if (fonts.length === 0) return undefined;

  const cached = fontCache.get(configVersion);
  if (cached) return await cached;

  bundledFont ??= loadBundledFont();
  const loading = Promise.all([
    Promise.all(fonts.map(loadFont)),
    bundledFont,
  ]).then(([configured, fallback]) =>
    fallback ? [...configured, fallback] : configured,
  );
  fontCache.set(configVersion, loading);

  try {
    return await loading;
  } catch (error) {
    fontCache.delete(configVersion);
    throw error;
  }
};
