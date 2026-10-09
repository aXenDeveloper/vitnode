// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { detectImageMimeType, isSignedImageMimeType } from "./image-signature";

const encode = async (
  format: "avif" | "gif" | "jpeg" | "png" | "tiff" | "webp",
): Promise<Buffer> =>
  await sharp({
    create: { background: "#369", channels: 3, height: 8, width: 8 },
  })
    .toFormat(format)
    .toBuffer();

const ftyp = (major: string, compatible: string[]): Uint8Array => {
  const text = `ftyp${major}\0\0\0\0${compatible.join("")}`;
  const bytes = new Uint8Array(4 + text.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(text), 4);

  return bytes;
};

describe("detectImageMimeType", () => {
  it.each([
    ["avif", "image/avif"],
    ["gif", "image/gif"],
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["tiff", "image/tiff"],
    ["webp", "image/webp"],
  ] as const)("recognises a real %s file", async (format, mimeType) => {
    expect(detectImageMimeType(await encode(format))).toBe(mimeType);
  });

  it("finds AVIF in the compatible brands", () => {
    expect(detectImageMimeType(ftyp("mif1", ["miaf", "avif"]))).toBe(
      "image/avif",
    );
  });

  it("does not take a HEIC photo for AVIF", () => {
    expect(detectImageMimeType(ftyp("heic", ["mif1", "heic"]))).toBeNull();
  });

  it("returns null for markup, text and nothing at all", () => {
    expect(
      detectImageMimeType(new TextEncoder().encode("<svg></svg>")),
    ).toBeNull();
    expect(detectImageMimeType(new TextEncoder().encode("hello"))).toBeNull();
    expect(detectImageMimeType(new Uint8Array())).toBeNull();
  });
});

describe("isSignedImageMimeType", () => {
  it("covers raster formats and leaves SVG alone", () => {
    expect(isSignedImageMimeType("image/png")).toBe(true);
    expect(isSignedImageMimeType("image/svg+xml")).toBe(false);
    expect(isSignedImageMimeType("application/pdf")).toBe(false);
  });
});
