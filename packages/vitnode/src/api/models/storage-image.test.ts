// @vitest-environment node
// Runs in the Node environment so sharp and real image buffers behave as they do
// on the server.
import type { Context } from "hono";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { StorageModel } from "./storage";

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
