// @vitest-environment node
// Runs in the Node environment so sharp and real image buffers behave as they do
// on the server.
import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { StorageImageUnprocessableError, StorageModel } from "./storage";

const makeCtx = (image?: { quality?: number; webp?: boolean }) => {
  const upload = vi.fn(
    ({ key }: { body: Buffer; contentType?: string; key: string }) => ({
      key,
      url: `https://cdn.test/${key}`,
    }),
  );
  // `upload` returns the created `core_files` row now, so the insert has to
  // resolve to something with an id - that identifier is what a file reference
  // is made of.
  // The argument is typed only so `insertValues.mock.calls[0][0]` is the recorded
  // row rather than `never`; the body has no use for it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const insertValues = vi.fn((_values: Record<string, unknown>) => ({
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  }));
  const store: Record<string, unknown> = {
    core: {
      storage: {
        adapter: { delete: vi.fn(), getUrl: (k: string) => k, upload },
        image,
      },
    },
    db: {
      insert: vi.fn(() => ({ values: insertValues })),
    },
    plugin: { id: "@vitnode/core" },
    user: { id: 7 },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    insertValues,
    upload,
  };
};

const makeJpeg = async (quality: number): Promise<Buffer> =>
  await sharp({
    create: {
      background: { b: 50, g: 100, r: 200 },
      channels: 3,
      height: 180,
      noise: { mean: 128, sigma: 60, type: "gaussian" },
      width: 320,
    },
  })
    .jpeg({ quality })
    .toBuffer();

const fileFrom = (buf: Buffer, name: string, type: string): File =>
  new File([new Uint8Array(buf)], name, { type });

describe("StorageModel image optimization", () => {
  it("converts a processed image to WebP by default", async () => {
    const original = await makeJpeg(100);
    const { ctx, upload, insertValues } = makeCtx({ quality: 40 });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    const call = upload.mock.calls[0][0];
    expect((await sharp(call.body).metadata()).format).toBe("webp");
    expect(call.contentType).toBe("image/webp");
    expect(call.key).toMatch(/\.webp$/);

    const row = insertValues.mock.calls[0][0];
    expect(row.name).toBe("photo.webp");
    expect(row.mimeType).toBe("image/webp");
  });

  it("records the pixel dimensions in metadata", async () => {
    const original = await makeJpeg(90);
    const { ctx, insertValues } = makeCtx({ quality: 80 });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    expect(insertValues.mock.calls[0][0].metadata).toMatchObject({
      dimensions: { width: 320, height: 180 },
    });
  });

  it("merges dimensions with caller-provided metadata", async () => {
    const original = await makeJpeg(90);
    const { ctx, insertValues } = makeCtx({ quality: 80 });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
      metadata: { alt: "a cat" },
    });

    expect(insertValues.mock.calls[0][0].metadata).toEqual({
      alt: "a cat",
      dimensions: { width: 320, height: 180 },
    });
  });

  it("keeps the original format when webp is disabled", async () => {
    const original = await makeJpeg(100);
    const { ctx, upload, insertValues } = makeCtx({ quality: 40, webp: false });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    const call = upload.mock.calls[0][0];
    expect((await sharp(call.body).metadata()).format).toBe("jpeg");
    expect(call.contentType).toBe("image/jpeg");
    expect(call.key).toMatch(/\.jpg$/);
    // still smaller than the original (re-encoded at lower quality)
    expect(call.body.length).toBeLessThan(original.length);
    // dimensions are still recorded regardless of the target format
    expect(insertValues.mock.calls[0][0].metadata).toMatchObject({
      dimensions: { width: 320, height: 180 },
    });
    expect(insertValues.mock.calls[0][0].name).toBe("photo.jpg");
  });

  it("stores the original bytes when image config is absent", async () => {
    const original = await makeJpeg(100);
    const { ctx, upload, insertValues } = makeCtx(undefined);

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    expect(upload.mock.calls[0][0].body.equals(original)).toBe(true);
    // no image processing means no recorded dimensions
    expect(insertValues.mock.calls[0][0].metadata).toEqual({});
  });

  /**
   * Every one of these used to answer "Invalid or corrupt image file", which
   * names no cause and no fix. The point of each assertion is the *specific*
   * thing it says instead.
   */
  describe("when sharp refuses the image", () => {
    const failing = async (buf: Buffer, name: string, type: string) => {
      const { ctx } = makeCtx({ quality: 85 });

      return await new StorageModel(ctx)
        .upload({ file: fileFrom(buf, name, type), folder: "photos" })
        .then(() => null)
        .catch((error: unknown) => error);
    };

    it("names libvips' own reason when the bytes will not decode", async () => {
      const error = await failing(
        Buffer.from("this is not a png at all"),
        "hero.png",
        "image/png",
      );

      expect(error).toBeInstanceOf(HTTPException);
      const { message, status } = error as HTTPException;
      expect(status).toBe(400);
      // The declared format, so a JPEG renamed `.png` reads as the mismatch it is.
      expect(message).toContain("PNG");
      expect(message).toContain("unsupported image format");
      expect(message).toMatch(/truncated/i);
    });

    it("says empty rather than corrupt for an empty upload", async () => {
      const error = await failing(Buffer.alloc(0), "hero.png", "image/png");

      expect((error as HTTPException).message).toMatch(/empty/i);
    });

    /**
     * A truncated PNG reads its header and then fails halfway through the pixel
     * data, so this is the one case that only surfaces at encode time - and it
     * really is a damaged file, unlike the case below.
     */
    it("reports a truncated file as damaged, with the size its header claims", async () => {
      const whole = await sharp({
        create: {
          background: "#c33",
          channels: 3,
          height: 900,
          noise: { mean: 128, sigma: 80, type: "gaussian" },
          width: 900,
        },
      })
        .png()
        .toBuffer();

      const error = await failing(
        whole.subarray(0, Math.floor(whole.length * 0.4)),
        "hero.png",
        "image/png",
      );

      expect(error).toBeInstanceOf(HTTPException);
      expect(error).not.toBeInstanceOf(StorageImageUnprocessableError);
      const { message } = error as HTTPException;
      expect(message).toContain("900\u00d7900");
      expect(message).toMatch(/damaged/i);
      expect(message).toContain("libpng");
    });
  });

  /**
   * WebP holds at most 16383 pixels per side, and an image taller than that is
   * still a perfectly good PNG - so the conversion is what gets dropped, not the
   * upload. 16384 is the real-world case: one pixel over.
   */
  describe("when the image is too large for WebP", () => {
    const tooTall = async (): Promise<Buffer> =>
      await sharp({
        create: { background: "#369", channels: 3, height: 16384, width: 200 },
      })
        .png()
        .toBuffer();

    it("stores it in its own format instead of refusing it", async () => {
      const { ctx, upload, insertValues } = makeCtx({ quality: 85 });

      const stored = await new StorageModel(ctx).upload({
        file: fileFrom(await tooTall(), "cover.png", "image/png"),
        folder: "photos",
      });

      const call = upload.mock.calls[0][0];
      expect((await sharp(call.body).metadata()).format).toBe("png");
      expect(call.contentType).toBe("image/png");
      // The key and the display name have to agree with the bytes, so neither
      // may claim `.webp` when the conversion did not happen.
      expect(call.key).toMatch(/\.png$/);
      expect(stored.name).toBe("cover.png");
      expect(stored.mimeType).toBe("image/png");
      expect(insertValues.mock.calls[0][0].name).toBe("cover.png");
    });

    it("still measures it, and records why it stayed a PNG", async () => {
      const { ctx, insertValues } = makeCtx({ quality: 85 });

      await new StorageModel(ctx).upload({
        file: fileFrom(await tooTall(), "cover.png", "image/png"),
        folder: "photos",
        metadata: { alt: "a tall thing" },
      });

      expect(insertValues.mock.calls[0][0].metadata).toEqual({
        alt: "a tall thing",
        dimensions: { width: 200, height: 16384 },
        skippedConversion: "webp-dimension-limit",
      });
    });

    it("says nothing about a skipped conversion when WebP was never asked for", async () => {
      const { ctx, insertValues } = makeCtx({ quality: 85, webp: false });

      await new StorageModel(ctx).upload({
        file: fileFrom(await tooTall(), "cover.png", "image/png"),
        folder: "photos",
      });

      expect(insertValues.mock.calls[0][0].metadata).toEqual({
        dimensions: { width: 200, height: 16384 },
      });
    });

    /**
     * One pixel under the limit is converted as usual - the fallback must not
     * quietly swallow every large image.
     */
    it("converts an image that fits exactly", async () => {
      const fits = await sharp({
        create: { background: "#369", channels: 3, height: 16383, width: 200 },
      })
        .png()
        .toBuffer();
      const { ctx, upload } = makeCtx({ quality: 85 });

      await new StorageModel(ctx).upload({
        file: fileFrom(fits, "cover.png", "image/png"),
        folder: "photos",
      });

      expect(upload.mock.calls[0][0].contentType).toBe("image/webp");
    });
  });

  it("leaves non-image files untouched even when image config is set", async () => {
    const original = Buffer.from("just some text");
    const { ctx, upload } = makeCtx({ quality: 40 });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "notes.txt", "text/plain"),
      folder: "docs",
    });

    expect(upload.mock.calls[0][0].body.equals(original)).toBe(true);
  });
});
