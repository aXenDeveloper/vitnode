import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import { core_files } from "@/database/files";
import { buildStorageKey, generateStorageFileName } from "@/lib/api/upload";

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
   * null. Pass it explicitly — including `null` — to override, e.g. when an admin
   * uploads on behalf of another user.
   */
  userId?: null | number;
}

export class StorageModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  // Re-encodes images with sharp at the configured quality when
  // `storage.image` is set. Keeps the same format, so the key/contentType stay
  // valid. sharp is imported lazily so it is only loaded when actually used.
  private async optimizeImage(body: Buffer, mimeType: string): Promise<Buffer> {
    const image = this.c.get("core").storage?.image;
    if (!image || !PROCESSABLE_IMAGE_MIME_TYPES.has(mimeType)) {
      return body;
    }

    const quality = image.quality ?? DEFAULT_IMAGE_QUALITY;

    try {
      const { default: sharp } = await import("sharp");
      const format = (await sharp(body).metadata()).format;
      if (!format) {
        return body;
      }

      return await sharp(body).toFormat(format, { quality }).toBuffer();
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
  }: StorageUploadOptions): Promise<StorageUploadResult> {
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

    const key = buildStorageKey({
      folder,
      fileName: generateStorageFileName(file.name),
    });
    const body = await this.optimizeImage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );

    const result = await provider.upload({
      key,
      body,
      contentType: file.type || undefined,
    });

    const ownerId =
      userId !== undefined
        ? userId
        : (this.c.get("admin")?.user.id ?? this.c.get("user")?.id ?? null);

    try {
      await this.c
        .get("db")
        .insert(core_files)
        .values({
          name: file.name,
          key: result.key,
          folder,
          mimeType: file.type || null,
          size: body.length,
          userId: ownerId,
          pluginId: this.c.get("plugin")?.id ?? null,
          metadata: metadata ?? {},
        });
    } catch (error) {
      await provider.delete(result.key).catch(() => undefined);
      throw error;
    }

    return result;
  }
}
