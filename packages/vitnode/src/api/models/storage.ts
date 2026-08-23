import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { core_files } from "@/database/files";
import {
  buildStorageKey,
  generateStorageFileName,
  replaceFileExtension,
} from "@/lib/api/upload";
import { isMimeTypeAllowed } from "@/lib/upload-limits";

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
 * An upload plus the `core_files` row it created - what a route hands back to a
 * form so it can render the file and, later, delete it by id.
 */
export interface StorageFileResult extends StorageUploadResult {
  id: number;
  mimeType: null | string;
  /** Stored display name, which differs from the original when a conversion changed the format. */
  name: string;
  /** Size after image processing, i.e. what counts against the user's quota. */
  size: number;
}

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
  /**
   * Allowed MIME types (e.g. `["image/png", "image/jpeg"]`), `image/*` wildcards
   * included. Omit to allow any.
   */
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
   * Removes a stored file by its `core_files` id: deletes the underlying object
   * from the storage provider (best-effort - a missing object doesn't block the
   * record removal), then deletes the database row. Throws a 404 when no file
   * with that id exists. Pass `ownerId` to scope the delete to that user's files
   * (so a user can only remove their own uploads).
   */
  async deleteFile(id: number, ownerId?: number): Promise<void> {
    const db = this.c.get("db");
    const where =
      ownerId === undefined
        ? eq(core_files.id, id)
        : and(eq(core_files.id, id), eq(core_files.userId, ownerId));

    const [row] = await db
      .select({ key: core_files.key })
      .from(core_files)
      .where(where)
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "File not found" });
    }

    const provider = this.c.get("core").storage?.adapter;
    if (provider) {
      await provider.delete(row.key).catch(() => undefined);
    }

    await db.delete(core_files).where(where);
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
  }: StorageUploadOptions): Promise<StorageFileResult> {
    const provider = this.requireProvider();

    if (maxBytes !== undefined && file.size > maxBytes) {
      throw new HTTPException(400, {
        message: `File exceeds the maximum size of ${maxBytes} bytes`,
      });
    }
    if (!isMimeTypeAllowed(file.type, allowedMimeTypes)) {
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

    try {
      const [row] = await this.c
        .get("db")
        .insert(core_files)
        .values({
          name: displayName,
          key: result.key,
          folder,
          mimeType: processed.mimeType || null,
          size: processed.body.length,
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

      return {
        ...result,
        id: row.id,
        mimeType: processed.mimeType || null,
        name: displayName,
        size: processed.body.length,
      };
    } catch (error) {
      await provider.delete(result.key).catch(() => undefined);
      throw error;
    }
  }
}
