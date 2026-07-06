// @vitest-environment node
// Runs in the Node environment so sharp and real image buffers behave as they do
// on the server.
import type { Context } from "hono";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { StorageModel } from "./storage";

const makeCtx = (image?: { quality?: number }) => {
  const upload = vi.fn(
    ({ key }: { body: Buffer; contentType?: string; key: string }) => ({
      key,
      url: `https://cdn.test/${key}`,
    }),
  );
  const store: Record<string, unknown> = {
    core: {
      storage: {
        adapter: { delete: vi.fn(), getUrl: (k: string) => k, upload },
        image,
      },
    },
    db: {
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    },
    plugin: { id: "@vitnode/core" },
    user: { id: 7 },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    upload,
  };
};

const makeJpeg = async (quality: number): Promise<Buffer> =>
  await sharp({
    create: {
      background: { b: 50, g: 100, r: 200 },
      channels: 3,
      height: 256,
      noise: { mean: 128, sigma: 60, type: "gaussian" },
      width: 256,
    },
  })
    .jpeg({ quality })
    .toBuffer();

const fileFrom = (buf: Buffer, name: string, type: string): File =>
  new File([new Uint8Array(buf)], name, { type });

describe("StorageModel image optimization", () => {
  it("re-encodes an image at the configured quality when image config is set", async () => {
    const original = await makeJpeg(100);
    const { ctx, upload } = makeCtx({ quality: 40 });

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    const stored = upload.mock.calls[0][0].body;
    expect((await sharp(stored).metadata()).format).toBe("jpeg");
    expect(stored.equals(original)).toBe(false);
    expect(stored.length).toBeLessThan(original.length);
  });

  it("stores the original bytes when image config is absent", async () => {
    const original = await makeJpeg(100);
    const { ctx, upload } = makeCtx(undefined);

    await new StorageModel(ctx).upload({
      file: fileFrom(original, "photo.jpg", "image/jpeg"),
      folder: "photos",
    });

    expect(upload.mock.calls[0][0].body.equals(original)).toBe(true);
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
