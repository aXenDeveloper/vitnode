export const SIGNED_IMAGE_MIME_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
] as const;

export type SignedImageMimeType = (typeof SIGNED_IMAGE_MIME_TYPES)[number];

export const isSignedImageMimeType = (
  mimeType: string,
): mimeType is SignedImageMimeType =>
  (SIGNED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const readUint32BE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) * 0x1000000 +
  ((bytes[offset + 1] ?? 0) << 16) +
  ((bytes[offset + 2] ?? 0) << 8) +
  (bytes[offset + 3] ?? 0);

const AVIF_BRANDS = new Set(["avif", "avis"]);

const isAvif = (bytes: Uint8Array): boolean => {
  if (ascii(bytes, 4, 4) !== "ftyp") return false;

  const boxSize = Math.min(readUint32BE(bytes, 0), bytes.length, 256);
  if (AVIF_BRANDS.has(ascii(bytes, 8, 4))) return true;

  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    if (AVIF_BRANDS.has(ascii(bytes, offset, 4))) return true;
  }

  return false;
};

export const detectImageMimeType = (
  bytes: Uint8Array,
): null | SignedImageMimeType => {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (starts([0x49, 0x49, 0x2a, 0x00]) || starts([0x4d, 0x4d, 0x00, 0x2a])) {
    return "image/tiff";
  }
  if (isAvif(bytes)) return "image/avif";

  return null;
};
