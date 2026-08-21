import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { core_files } from "@/database/files";
import { isPgReferenceViolation } from "@/lib/api/pg-error";
import {
  buildStorageKey,
  generateStorageFileName,
  replaceFileExtension,
} from "@/lib/api/upload";

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

/** Why {@link StorageModel.deleteFile} refused. */
export const STORAGE_FILE_IN_USE = "FILE_IN_USE";

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
}

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
      return { body, mimeType, extension: null, dimensions: null };
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
        message: "Image optimization library (sharp) failed to load",
      });
    }

    try {
      const metadata = await sharp(body).metadata();
      if (!metadata.format) {
        return { body, mimeType, extension: null, dimensions: null };
      }

      const targetFormat = toWebp ? "webp" : metadata.format;
      const output = await sharp(body)
        .toFormat(targetFormat, { quality })
        .toBuffer();

      return {
        body: output,
        mimeType: toWebp ? "image/webp" : mimeType,
        extension: toWebp ? ".webp" : null,
        dimensions:
          metadata.width && metadata.height
            ? { width: metadata.width, height: metadata.height }
            : null,
      };
    } catch {
      throw new HTTPException(400, {
        message: "Invalid or corrupt image file",
      });
    }
  }

  private requireProvider(): StorageApiPlugin {
    const provider = this.c.get("core").storage?.adapter;
    if (!provider) {
      throw new HTTPException(500, {
        message: "Storage provider not found",
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
   * So:
   *
   * - still referenced -> **409 `FILE_IN_USE`**, and the object is untouched;
   * - row removed -> the object is deleted, best-effort (a missing object must
   *   not fail a delete that already committed);
   * - no such row -> 404.
   *
   * An orphaned storage object is the failure this prefers. It costs disk; a
   * content record pointing at bytes that are gone costs a broken page nobody
   * can repair from the AdminCP.
   *
   * Pass `ownerId` to scope the delete to that user's own uploads.
   */
  async deleteFile(id: number, ownerId?: number): Promise<void> {
    const db = this.c.get("db");
    const where =
      ownerId === undefined
        ? eq(core_files.id, id)
        : and(eq(core_files.id, id), eq(core_files.userId, ownerId));

    let deleted: undefined | { key: string };
    try {
      [deleted] = await db
        .delete(core_files)
        .where(where)
        .returning({ key: core_files.key });
    } catch (error) {
      if (!isPgReferenceViolation(error)) throw error;

      // The bytes are still there, which is the point: whoever is using this
      // file still has a working file.
      throw new HTTPException(409, {
        res: Response.json({ code: STORAGE_FILE_IN_USE, id }, { status: 409 }),
      });
    }

    if (!deleted) {
      throw new HTTPException(404, { message: "File not found" });
    }

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
        message: `File exceeds the maximum size of ${maxBytes} bytes`,
      });
    }
    if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
      throw new HTTPException(400, {
        message: `Unsupported file type: ${file.type || "unknown"}`,
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
        message: "The uploaded file could not be recorded",
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
