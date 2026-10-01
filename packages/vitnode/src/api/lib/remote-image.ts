import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export const REMOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const REMOTE_IMAGE_MAX_DIMENSION = 8192;

const REMOTE_IMAGE_MAX_PIXELS = 40_000_000;

const DEFAULT_MAX_REDIRECTS = 3;

const DEFAULT_TIMEOUT_MS = 8000;

const MAX_URL_LENGTH = 2048;

export type RemoteImageFailure =
  | "blocked_address"
  | "http_error"
  | "invalid_url"
  | "network"
  | "too_large"
  | "too_many_redirects"
  | "unsupported_type";

export class RemoteImageError extends Error {
  constructor(reason: RemoteImageFailure) {
    super(`Remote image rejected: ${reason}`);
    this.name = "RemoteImageError";
    this.reason = reason;
  }

  readonly reason: RemoteImageFailure;
}

const blockedAddresses = (() => {
  const list = new BlockList();
  const v4: [string, number][] = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  const v6: [string, number][] = [
    ["::", 128],
    ["::1", 128],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
  ];

  for (const [address, prefix] of v4) list.addSubnet(address, prefix, "ipv4");
  for (const [address, prefix] of v6) list.addSubnet(address, prefix, "ipv6");

  return list;
})();

const MAPPED_IPV4 = /^::ffff:(?<v4>\d{1,3}(?:\.\d{1,3}){3})$/i;

const mappedHexIpv4 = (address: string): null | string => {
  const match = /^::ffff:(?<high>[\da-f]{1,4}):(?<low>[\da-f]{1,4})$/i.exec(
    address,
  );
  if (!match?.groups) return null;

  const high = Number.parseInt(match.groups.high ?? "0", 16);
  const low = Number.parseInt(match.groups.low ?? "0", 16);

  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
};

export const isPublicIpAddress = (raw: string): boolean => {
  const address = raw.replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  const version = isIP(address);
  if (version === 0) return false;

  if (version === 6) {
    const embedded =
      MAPPED_IPV4.exec(address)?.groups?.v4 ?? mappedHexIpv4(address);
    if (embedded) return isPublicIpAddress(embedded);
    if (/^::ffff:/i.test(address)) return false;

    return !blockedAddresses.check(address, "ipv6");
  }

  if (address === "255.255.255.255") return false;

  return !blockedAddresses.check(address, "ipv4");
};

export type ResolveHost = (hostname: string) => Promise<string[]>;

const resolveHostAddresses: ResolveHost = async hostname =>
  await new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) {
        reject(new RemoteImageError("network"));

        return;
      }

      resolve(addresses.map(entry => entry.address));
    });
  });

export const publicOnlyLookup: LookupFunction = (
  hostname,
  options,
  callback,
) => {
  dnsLookup(
    hostname,
    { ...options, all: true },
    (error, addresses: LookupAddress[]) => {
      if (error) {
        callback(error, "", 4);

        return;
      }

      const [first] = addresses;
      if (
        !first ||
        addresses.some(entry => !isPublicIpAddress(entry.address))
      ) {
        callback(new RemoteImageError("blocked_address"), "", 4);

        return;
      }

      if (options.all) {
        callback(null, addresses);

        return;
      }

      callback(null, first.address, first.family);
    },
  );
};

export interface RemoteImageResponse {
  body: AsyncIterable<Uint8Array>;
  contentLength: null | number;
  destroy: () => void;
  location: null | string;
  status: number;
}

export type RemoteImageTransport = (
  url: URL,
  options: { lookup: LookupFunction; signal: AbortSignal },
) => Promise<RemoteImageResponse>;

export const httpsImageTransport: RemoteImageTransport = async (
  url,
  { lookup, signal },
) =>
  await new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        agent: false,
        headers: {
          accept: "image/webp,image/png,image/jpeg",
          "user-agent": "VitNode avatar import",
        },
        lookup,
        method: "GET",
        signal,
      },
      response => {
        const length = Number(response.headers["content-length"]);

        resolve({
          body: response,
          contentLength: Number.isFinite(length) ? length : null,
          destroy: () => response.destroy(),
          location: response.headers.location ?? null,
          status: response.statusCode ?? 0,
        });
      },
    );

    request.on("error", error => {
      reject(
        error instanceof RemoteImageError
          ? error
          : new RemoteImageError("network"),
      );
    });
    request.end();
  });

export type RemoteImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export const sniffImageMimeType = (
  bytes: Uint8Array,
): null | RemoteImageMimeType => {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }

  return null;
};

const readUint16BE = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const readUint24LE = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] ?? 0) |
  ((bytes[offset + 1] ?? 0) << 8) |
  ((bytes[offset + 2] ?? 0) << 16);

const readUint32BE = (bytes: Uint8Array, offset: number) =>
  readUint16BE(bytes, offset) * 65536 + readUint16BE(bytes, offset + 2);

const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const jpegDimensions = (bytes: Uint8Array) => {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = readUint16BE(bytes, offset + 2);
    if (JPEG_FRAME_MARKERS.has(marker)) {
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }
    offset += 2 + length;
  }

  return null;
};

const webpDimensions = (bytes: Uint8Array) => {
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === "VP8X") {
    return {
      height: readUint24LE(bytes, 27) + 1,
      width: readUint24LE(bytes, 24) + 1,
    };
  }
  if (chunk === "VP8L") {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;

    return {
      height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      width: 1 + (((b1 & 0x3f) << 8) | b0),
    };
  }
  if (chunk === "VP8 ") {
    return {
      height: (((bytes[29] ?? 0) << 8) | (bytes[28] ?? 0)) & 0x3fff,
      width: (((bytes[27] ?? 0) << 8) | (bytes[26] ?? 0)) & 0x3fff,
    };
  }

  return null;
};

export const imageDimensions = (
  bytes: Uint8Array,
  mimeType: RemoteImageMimeType,
): null | { height: number; width: number } => {
  if (mimeType === "image/png") {
    if (bytes.length < 24) return null;

    return { height: readUint32BE(bytes, 20), width: readUint32BE(bytes, 16) };
  }
  if (mimeType === "image/webp") return webpDimensions(bytes);

  return jpegDimensions(bytes);
};

export const IMAGE_EXTENSIONS: Record<RemoteImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface RemoteImage {
  bytes: Uint8Array<ArrayBuffer>;
  height: number;
  mimeType: RemoteImageMimeType;
  width: number;
}

const assertFetchableUrl = async (
  url: URL,
  resolveHost: ResolveHost,
): Promise<void> => {
  if (url.protocol !== "https:") throw new RemoteImageError("invalid_url");
  if (url.username || url.password) throw new RemoteImageError("invalid_url");
  if (url.port && url.port !== "443") throw new RemoteImageError("invalid_url");

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) !== 0) {
    if (!isPublicIpAddress(hostname)) {
      throw new RemoteImageError("blocked_address");
    }

    return;
  }
  if (!hostname.includes(".") || hostname.endsWith(".localhost")) {
    throw new RemoteImageError("blocked_address");
  }

  const addresses = await resolveHost(hostname);
  if (
    addresses.length === 0 ||
    addresses.some(address => !isPublicIpAddress(address))
  ) {
    throw new RemoteImageError("blocked_address");
  }
};

const parseUrl = (raw: string, base?: URL): URL => {
  if (raw.length > MAX_URL_LENGTH) throw new RemoteImageError("invalid_url");

  try {
    return new URL(raw, base);
  } catch {
    throw new RemoteImageError("invalid_url");
  }
};

const readCapped = async (
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new RemoteImageError("too_large");
    chunks.push(chunk);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

export const downloadRemoteImage = async (
  rawUrl: string,
  {
    maxBytes,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    resolveHost = resolveHostAddresses,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    transport = httpsImageTransport,
  }: {
    maxBytes: number;
    maxRedirects?: number;
    resolveHost?: ResolveHost;
    timeoutMs?: number;
    transport?: RemoteImageTransport;
  },
): Promise<RemoteImage> => {
  const limit = Math.min(maxBytes, REMOTE_IMAGE_MAX_BYTES);
  const signal = AbortSignal.timeout(timeoutMs);
  let url = parseUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertFetchableUrl(url, resolveHost);

    let response: RemoteImageResponse;
    try {
      response = await transport(url, { lookup: publicOnlyLookup, signal });
    } catch (error) {
      if (error instanceof RemoteImageError) throw error;

      throw new RemoteImageError("network");
    }

    if (response.status >= 300 && response.status < 400) {
      response.destroy();
      if (!response.location) throw new RemoteImageError("http_error");
      url = parseUrl(response.location, url);
      continue;
    }

    if (response.status !== 200) {
      response.destroy();
      throw new RemoteImageError("http_error");
    }

    if (response.contentLength !== null && response.contentLength > limit) {
      response.destroy();
      throw new RemoteImageError("too_large");
    }

    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await readCapped(response.body, limit);
    } catch (error) {
      response.destroy();
      if (error instanceof RemoteImageError) throw error;

      throw new RemoteImageError("network");
    }

    const mimeType = sniffImageMimeType(bytes);
    if (!mimeType) throw new RemoteImageError("unsupported_type");

    const dimensions = imageDimensions(bytes, mimeType);
    if (
      !dimensions ||
      dimensions.width < 1 ||
      dimensions.height < 1 ||
      dimensions.width > REMOTE_IMAGE_MAX_DIMENSION ||
      dimensions.height > REMOTE_IMAGE_MAX_DIMENSION ||
      dimensions.width * dimensions.height > REMOTE_IMAGE_MAX_PIXELS
    ) {
      throw new RemoteImageError("unsupported_type");
    }

    return { bytes, mimeType, ...dimensions };
  }

  throw new RemoteImageError("too_many_redirects");
};
