import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { StorageFileInUseBody } from "@/lib/files/in-use";

import { core_content_file_refs } from "@/database/content";
import { core_files } from "@/database/files";
import { isPgReferenceViolation } from "@/lib/api/pg-error";
import {
  buildStorageKey,
  generateStorageFileName,
  replaceFileExtension,
} from "@/lib/api/upload";
import { STORAGE_FILE_IN_USE } from "@/lib/files/in-use";
import { formatBytes } from "@/lib/format-bytes";

const DEFAULT_IMAGE_QUALITY = 85;

// Formats sharp can lossily re-encode. SVG/GIF are intentionally excluded to
// preserve vectors and animation.
const PROCESSABLE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

export interface StorageUploadArgs {
  body: Buffer;
  contentType?: string;
  key: string;
}

export interface StorageUploadResult {
  key: string;
  url: string;
}

/**
 * What {@link StorageModel.upload} returns: the adapter's result plus the
 * `core_files` row it just created.
 *
 * The adapter still returns only `{ key, url }` - it stores bytes and knows
 * nothing about the database - so this is a separate type rather than a widened
 * one. `id` is what a caller needs to *reference* the file: a Content Engine
 * file column holds it, and without it every upload route would have to look the
 * row back up by key.
 *
 * `dimensions` is `null` for a non-image and for an image the pipeline did not
 * measure (SVG and GIF are deliberately not re-encoded).
 */
export interface StorageFileUploadResult extends StorageUploadResult {
  dimensions: null | { height: number; width: number };
  id: number;
  mimeType: null | string;
  /** The display name as stored, which a format conversion may have changed. */
  name: string;
  size: number;
}

/**
 * Why {@link StorageModel.deleteFile} refused, and the body it refuses with.
 *
 * Defined in `@/lib/files/in-use` and re-exported here, so every existing
 * importer keeps working. The definition had to move because the browser reads
 * the same code off the same 409 - and importing it from this module dragged
 * Hono, Drizzle and `@/database` into the client bundle behind one string.
 */
export type { StorageFileInUseBody } from "@/lib/files/in-use";
export { STORAGE_FILE_IN_USE } from "@/lib/files/in-use";

export interface StorageDeleteFileOptions {
  /**
   * Drop the retained revisions' pins and delete the file anyway.
   *
   * Only ever gets past *history*. A live content reference is refused with or
   * without it, because there is no version of "delete anyway" that leaves a
   * published page unbroken.
   */
  force?: boolean;
  /** Scopes the delete to one user's own uploads. */
  ownerId?: number;
}

const storageFileInUse = (body: Omit<StorageFileInUseBody, "code">) =>
  new HTTPException(409, {
    res: Response.json(
      { code: STORAGE_FILE_IN_USE, ...body } satisfies StorageFileInUseBody,
      { status: 409 },
    ),
  });

/**
 * Present only on disk-backed adapters (e.g. Local). The Node entry point reads
 * it to mount `serveStatic` for the stored files. Cloud adapters omit it.
 */
export interface StorageStaticConfig {
  mountPath: string;
  root: string;
  stripPrefix: string;
}

export interface StorageApiPlugin {
  delete: (key: string) => Promise<void>;
  getUrl: (key: string) => string;
  static?: StorageStaticConfig;
  upload: (args: StorageUploadArgs) => Promise<StorageUploadResult>;
}

export interface StorageUploadOptions {
  /** Allowed MIME types (e.g. `["image/png", "image/jpeg"]`). Omit to allow any. */
  allowedMimeTypes?: string[];
  file: File;
  /** Sub-folder under the dated prefix, e.g. `avatars` -> `month_7_2026/avatars/…`. */
  folder: string;
  /** Maximum file size in bytes. Omit for no limit. */
  maxBytes?: number;
  /** Extra data stored in the `core_files.metadata` JSON column. */
  metadata?: Record<string, unknown>;
  /**
   * Owner recorded in `core_files.userId`. When omitted it defaults to the
   * request's admin user (on admin routes), then the frontend session user, else
   * null. Pass it explicitly - including `null` - to override, e.g. when an admin
   * uploads on behalf of another user.
   */
  userId?: null | number;
}

interface ProcessedImage {
  body: Buffer;
  dimensions: null | { height: number; width: number };
  // New extension (incl. leading dot) when the format changed, else null.
  extension: null | string;
  mimeType: string;
  /**
   * Why the configured WebP conversion did not happen, when it was configured
   * and did not - otherwise null.
   *
   * Recorded on the `core_files` row because the decision is otherwise invisible:
   * an install with `storage.image.webp` whose library has one stray PNG among
   * the WebPs looks like a bug until this says which rule spared it.
   */
  skippedConversion: null | string;
}

/**
 * The image decoded, and then could not be re-encoded because of a **format
 * limit rather than the bytes**: WebP allows at most 16383 pixels per side, and
 * a 20000px-wide PNG is a perfectly valid PNG.
 *
 * Its own class so a caller can tell this apart from a broken file - the upload
 * route answers `CONTENT_FILE_UNPROCESSABLE` for it instead of
 * `CONTENT_FILE_INVALID`. The distinction is the whole point: "corrupt" sends
 * somebody off to re-export an image that was never damaged, while naming the
 * pixel limit sends them to resize it, which is the thing that works.
 */
export class StorageImageUnprocessableError extends HTTPException {
  constructor(message: string) {
    super(400, { message });

    this.name = "StorageImageUnprocessableError";
  }
}

/** The largest side libwebp will encode. Anything over it is refused outright. */
const WEBP_MAX_SIDE = 16383;

/** Marks a row whose WebP conversion was skipped for the reason below. */
const SKIPPED_WEBP_DIMENSIONS = "webp-dimension-limit";

/**
 * Whether WebP can hold an image this size at all.
 *
 * Unmeasured dimensions answer `false`: an image libvips could not size up is
 * not one to pre-emptively give up converting, so the encoder stays the thing
 * that decides.
 */
const exceedsWebpLimit = (
  dimensions: null | { height: number; width: number },
): boolean =>
  dimensions !== null &&
  (dimensions.width > WEBP_MAX_SIDE || dimensions.height > WEBP_MAX_SIDE);

/** `image/png` -> `PNG`, for a sentence somebody reads rather than a header. */
const imageFormatName = (mimeType: string): string =>
  (mimeType.split("/")[1] ?? mimeType).toUpperCase();

/**
 * What sharp itself said, as a suffix - or nothing when it said nothing useful.
 *
 * libvips writes the actionable part of these ("Input buffer contains
 * unsupported image format", "vipspng: libpng read error", "Input Buffer is
 * empty"), and dropping it is what left an admin with a sentence that named no
 * cause. Only the first line is kept, and it is capped, because the rest is a
 * stack trace and this ends up in a form field.
 */
const reasonSuffix = (error: unknown): string => {
  const first =
    error instanceof Error
      ? (error.message
          .split("\n")[0]
          ?.trim()
          .replace(/[.:]+$/, "") ?? "")
      : "";

  return first === "" ? "" : `: ${first.slice(0, 160)}`;
};

/**
 * Turns a failed re-encode into the most specific thing that can be said.
 *
 * Two outcomes, and both were previously "Invalid or corrupt image file":
 *
 * - **over the format's pixel limit** - sharp says "too large for the WebP
 *   format" and the file itself is fine. `exceedsWebpLimit` heads this off for
 *   every image libvips could measure, so reaching it means an unmeasured image
 *   or a limit of some other target format - a backstop, and it still has to say
 *   which limit rather than "corrupt";
 * - **anything else** - the header read but the pixel data did not, which is a
 *   genuinely damaged or truncated file.
 */
const imageEncodeFailure = ({
  dimensions,
  error,
  mimeType,
  targetFormat,
}: {
  dimensions: null | { height: number; width: number };
  error: unknown;
  mimeType: string;
  targetFormat: string;
}): HTTPException => {
  const size = dimensions
    ? `${dimensions.width}\u00d7${dimensions.height} pixels`
    : "this size";
  const target = targetFormat.toUpperCase();
  const tooLarge =
    error instanceof Error &&
    /too large for the .* format/i.test(error.message);

  if (tooLarge) {
    const limit =
      targetFormat === "webp"
        ? ` ${target} allows at most ${WEBP_MAX_SIDE} pixels per side.`
        : "";

    return new StorageImageUnprocessableError(
      `This image is ${size}, which is too large to convert to ${target}.${limit} Resize it and upload it again.`,
    );
  }

  return new HTTPException(400, {
    message: `This ${imageFormatName(mimeType)} file is damaged${reasonSuffix(error)}. Its header reads as ${size}, but the image data could not be decoded - the file is most likely truncated or was cut short in transfer.`,
  });
};

export class StorageModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  // Re-encodes images with sharp when `storage.image` is set: shrinks them at
  // the configured quality, converts to WebP unless disabled, and reads their
  // pixel dimensions. Non-image files (and everything when `image` is off) pass
  // through untouched. sharp is imported lazily so it only loads when used.
  private async processImage(
    body: Buffer,
    mimeType: string,
  ): Promise<ProcessedImage> {
    const image = this.c.get("core")?.storage?.image;
    if (!image || !PROCESSABLE_IMAGE_MIME_TYPES.has(mimeType)) {
      return {
        body,
        mimeType,
        extension: null,
        dimensions: null,
        skippedConversion: null,
      };
    }

    const quality = image.quality ?? DEFAULT_IMAGE_QUALITY;
    const toWebp = image.webp !== false;

    let sharp;
    try {
      const { default: s } = await import("sharp");
      sharp = s;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new HTTPException(500, {
        message:
          "The image optimization library (sharp) failed to load, so images cannot be processed. Install `sharp` on the API server, or remove `storage.image` from the API config to store images as they are uploaded.",
      });
    }

    // Reading and re-encoding are caught separately because they fail for
    // different reasons and only one of them means "bad file". A PNG that will
    // not decode at all is broken; a PNG that decodes and then will not
    // re-encode is usually too big for the target format, which is a limit
    // rather than a fault. Collapsing both into "Invalid or corrupt image file"
    // sent people off to re-export an image that was never corrupt.
    let metadata;
    try {
      metadata = await sharp(body).metadata();
    } catch (error) {
      throw new HTTPException(400, {
        message: `Could not read this ${imageFormatName(mimeType)} file${reasonSuffix(error)}. It may be truncated, or another format saved under the wrong extension.`,
      });
    }

    if (!metadata.format) {
      return {
        body,
        mimeType,
        extension: null,
        dimensions: null,
        skippedConversion: null,
      };
    }

    const dimensions =
      metadata.width && metadata.height
        ? { width: metadata.width, height: metadata.height }
        : null;

    // A 2944x16384 PNG is one pixel too tall for WebP and an entirely valid PNG,
    // so it is stored as a PNG. Checked here rather than caught from the encoder
    // because the right answer is not to refuse the upload: `storage.image.webp`
    // asks for smaller files, and it does not follow from that that an image the
    // format cannot hold should be rejected instead of kept as it arrived.
    //
    // Only the *format* is given up - never pixels. Downscaling to fit would be
    // the other way to keep WebP, and it is not this function's call to make:
    // nothing in the config asked for the image to be altered.
    const asWebp = toWebp && !exceedsWebpLimit(dimensions);
    const targetFormat = asWebp ? "webp" : metadata.format;

    let output: Buffer;
    try {
      output = await sharp(body).toFormat(targetFormat, { quality }).toBuffer();
    } catch (error) {
      throw imageEncodeFailure({
        dimensions,
        error,
        mimeType,
        targetFormat,
      });
    }

    return {
      body: output,
      mimeType: asWebp ? "image/webp" : mimeType,
      extension: asWebp ? ".webp" : null,
      dimensions,
      skippedConversion: toWebp && !asWebp ? SKIPPED_WEBP_DIMENSIONS : null,
    };
  }

  private requireProvider(): StorageApiPlugin {
    const provider = this.c.get("core").storage?.adapter;
    if (!provider) {
      throw new HTTPException(500, {
        message:
          "No storage adapter is configured, so there is nowhere to put this file. Set `storage.adapter` in the API config.",
      });
    }

    return provider;
  }

  async delete(key: string): Promise<void> {
    await this.requireProvider().delete(key);
  }

  /**
   * Removes a stored file by its `core_files` id.
   *
   * **Database first, blob second**, and the order is the whole point. A Content
   * Engine file column references this table with `ON DELETE RESTRICT`, and so
   * does every retained revision's file pin - so the `DELETE` is what asks
   * Postgres "is anything still using this?", and it is the only thing that can
   * answer correctly under concurrency. Deleting the object first, as this used
   * to, meant a referenced file lost its bytes and *then* had its removal
   * refused: the article survived, pointing at a 404.
   *
   * The two things that can hold a file are **not** the same thing, and this
   * says which one did:
   *
   * - a **live** reference - a content column, or a gallery's junction row - is
   *   a page that would break. Refused, always: `409 FILE_IN_USE` with
   *   `content: true`, and no `force` gets past it.
   * - a **retained revision's pin** is history. Refused by default too, but with
   *   `content: false` and the number of revisions holding it, so the caller can
   *   ask again with `force` - which drops those pins and lets the file go.
   *
   * Without that second door the Files screen is a dead end: a cover image
   * swapped once is pinned by the revision that recorded the swap, and retention
   * only prunes when that *same record* is written again - so a file nothing
   * displays any more stays undeletable, quite possibly for ever.
   *
   * Everything else is unchanged: row removed -> the object is deleted,
   * best-effort (a missing object must not fail a delete that already
   * committed); no such row -> 404.
   *
   * An orphaned storage object is the failure this prefers. It costs disk; a
   * content record pointing at bytes that are gone costs a broken page nobody
   * can repair from the AdminCP.
   *
   * Pass `ownerId` to scope the delete to that user's own uploads.
   */
  async deleteFile(
    id: number,
    { force = false, ownerId }: StorageDeleteFileOptions = {},
  ): Promise<void> {
    const db = this.c.get("db");
    const where =
      ownerId === undefined
        ? eq(core_files.id, id)
        : and(eq(core_files.id, id), eq(core_files.userId, ownerId));

    // One transaction, whichever way it ends. The pins come out first *even when
    // `force` is false*, because that is what makes the answer exact: with them
    // gone, the `DELETE` still being refused means something live holds the file,
    // and it succeeding means only history did. A read of
    // `core_content_file_refs` could count the pins but never answer the first
    // question - the live side is one foreign key per content type in the
    // install, and enumerating them would be a guess that goes stale.
    //
    // Nothing is committed unless the caller asked for it: the un-forced refusal
    // throws, which rolls the pin delete back with it.
    const deleted = await db.transaction(async tx => {
      const pins = await tx
        .delete(core_content_file_refs)
        .where(eq(core_content_file_refs.fileId, id))
        .returning({ id: core_content_file_refs.id });

      let row: undefined | { key: string };
      try {
        [row] = await tx
          .delete(core_files)
          .where(where)
          .returning({ key: core_files.key });
      } catch (error) {
        if (!isPgReferenceViolation(error)) throw error;

        // The bytes are still there, which is the point: whoever is using this
        // file still has a working file.
        throw storageFileInUse({ content: true, id, revisions: pins.length });
      }

      if (!row) {
        throw new HTTPException(404, { message: "File not found" });
      }

      if (!force && pins.length > 0) {
        throw storageFileInUse({ content: false, id, revisions: pins.length });
      }

      return row;
    });

    // After the commit, and best-effort: the row is gone either way, so a
    // provider that is down leaves an orphaned object rather than a file record
    // nobody can remove.
    const provider = this.c.get("core").storage?.adapter;
    if (provider) {
      await provider.delete(deleted.key).catch(() => undefined);
    }
  }

  getUrl(key: string): string {
    return this.requireProvider().getUrl(key);
  }

  async upload({
    allowedMimeTypes,
    file,
    folder,
    maxBytes,
    metadata,
    userId,
  }: StorageUploadOptions): Promise<StorageFileUploadResult> {
    const provider = this.requireProvider();

    if (maxBytes !== undefined && file.size > maxBytes) {
      throw new HTTPException(400, {
        message: `This file is ${formatBytes(file.size)}. The maximum is ${formatBytes(maxBytes)}.`,
      });
    }
    if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
      throw new HTTPException(400, {
        message: `"${file.type || "unknown"}" is not an accepted file type here. Accepted: ${allowedMimeTypes.join(", ")}.`,
      });
    }

    const processed = await this.processImage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );

    // When a conversion changed the format, reflect the new extension in both
    // the stored key and the display name so downloads and previews are honest.
    const displayName = processed.extension
      ? replaceFileExtension(file.name, processed.extension)
      : file.name;
    const key = buildStorageKey({
      folder,
      fileName: generateStorageFileName(
        file.name,
        processed.extension ?? undefined,
        processed.mimeType,
      ),
    });

    const result = await provider.upload({
      key,
      body: processed.body,
      contentType: processed.mimeType || undefined,
    });

    const ownerId =
      userId !== undefined
        ? userId
        : (this.c.get("admin")?.user.id ?? this.c.get("user")?.id ?? null);

    const mimeType = processed.mimeType || null;
    const size = processed.body.length;

    let created: undefined | { id: number };
    try {
      // `.returning()` so the caller gets the identifier a reference is made of.
      // Looking the row back up by key would be a second statement answering a
      // question this one already knows.
      [created] = await this.c
        .get("db")
        .insert(core_files)
        .values({
          name: displayName,
          key: result.key,
          folder,
          mimeType,
          size,
          userId: ownerId,
          pluginId: this.c.get("plugin")?.id ?? null,
          metadata: {
            ...(metadata ?? {}),
            ...(processed.dimensions
              ? { dimensions: processed.dimensions }
              : {}),
            ...(processed.skippedConversion
              ? { skippedConversion: processed.skippedConversion }
              : {}),
          },
        })
        .returning({ id: core_files.id });
    } catch (error) {
      await provider.delete(result.key).catch(() => undefined);
      throw error;
    }

    if (!created) {
      await provider.delete(result.key).catch(() => undefined);
      throw new HTTPException(500, {
        message:
          "The file was stored but could not be recorded in the database, so it cannot be referenced. Nothing was kept - try again.",
      });
    }

    return {
      ...result,
      dimensions: processed.dimensions,
      id: created.id,
      mimeType,
      name: displayName,
      size,
    };
  }
}
