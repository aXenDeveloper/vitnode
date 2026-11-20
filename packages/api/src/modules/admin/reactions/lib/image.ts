import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import {
  REACTION_IMAGE_MIME_TYPES,
  REACTIONS_LIMITS,
} from "@/lib/reactions/const";

const FORMATS = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type Format = keyof typeof FORMATS;

const isFormat = (value: unknown): value is Format =>
  typeof value === "string" && value in FORMATS;

export interface StoredReactionImage {
  animated: boolean;
  fileId: number;
  height: null | number;
  posterFileId: null | number;
  posterUrl: null | string;
  url: string;
  width: null | number;
}

/**
 * Checks an uploaded reaction image by its real bytes (not its declared type),
 * scales it into a `REACTIONS_LIMITS.imageMaxSide` square keeping animation,
 * stores it and - for an animated image - a static PNG of its first frame.
 *
 * @throws `HTTPException(400)` for a file that is not PNG, JPEG, WebP or GIF, or too big.
 */
export const storeReactionImage = async (
  c: Context,
  file: File,
  userId: number,
): Promise<StoredReactionImage> => {
  if (file.size > REACTIONS_LIMITS.imageMaxBytes) {
    throw new HTTPException(400, {
      message: `The image is larger than ${REACTIONS_LIMITS.imageMaxBytes / 1024} KB.`,
    });
  }

  const { default: sharp } = await import("sharp");
  const input = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(input, { animated: true })
    .metadata()
    .catch(() => null);
  if (!metadata || !isFormat(metadata.format)) {
    throw new HTTPException(400, {
      message: "Upload a PNG, JPEG, WebP or GIF image.",
    });
  }

  const format = metadata.format;
  const mimeType = FORMATS[format];
  const animated = (metadata.pages ?? 1) > 1;
  const side = REACTIONS_LIMITS.imageMaxSide;
  const width = metadata.width ?? null;
  const height = metadata.pageHeight ?? metadata.height ?? null;
  const tooBig = (width ?? 0) > side || (height ?? 0) > side;

  const body = tooBig
    ? await sharp(input, { animated: true })
        .resize(side, side, { fit: "inside", withoutEnlargement: true })
        .toFormat(format)
        .toBuffer()
    : input;
  const scaled = tooBig
    ? await sharp(body, { animated: true }).metadata()
    : metadata;
  const finalWidth = scaled.width ?? width;
  const finalHeight = scaled.pageHeight ?? scaled.height ?? height;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "reaction";
  const storage = c.get("storage");

  const stored = await storage.upload({
    allowedMimeTypes: [...REACTION_IMAGE_MIME_TYPES],
    file: new File([new Uint8Array(body)], `${baseName}.${format}`, {
      type: mimeType,
    }),
    folder: "reactions",
    maxBytes: REACTIONS_LIMITS.imageMaxBytes,
    metadata: {
      animated,
      height: finalHeight,
      source: "reaction",
      width: finalWidth,
    },
    userId,
  });

  let poster: null | { id: number; url: string } = null;
  if (animated) {
    const posterBody = await sharp(body).png().toBuffer();
    const storedPoster = await storage.upload({
      allowedMimeTypes: ["image/png"],
      file: new File([new Uint8Array(posterBody)], `${baseName}-poster.png`, {
        type: "image/png",
      }),
      folder: "reactions",
      metadata: {
        animated: false,
        height: finalHeight,
        source: "reaction-poster",
        width: finalWidth,
      },
      userId,
    });
    poster = { id: storedPoster.id, url: storedPoster.url };
  }

  return {
    animated,
    fileId: stored.id,
    height: finalHeight,
    posterFileId: poster?.id ?? null,
    posterUrl: poster?.url ?? null,
    url: stored.url,
    width: finalWidth,
  };
};

/** Deletes reaction image files no reaction points at any more. Best effort. */
export const deleteReactionFiles = async (
  c: Context,
  ids: readonly (null | number)[],
): Promise<void> => {
  const storage = c.get("storage");
  await Promise.all(
    ids
      .filter(id => id !== null)
      .map(async id => storage.deleteFile(id).catch(() => undefined)),
  );
};
