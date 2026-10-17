import type { LookupFunction } from "node:net";

import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import { isPublicIpAddress, publicOnlyLookup } from "../remote-image";

export const UPDATE_SOURCE_MAX_BYTES = 1024 * 1024;

const DEFAULT_TIMEOUT_MS = 10_000;

const DEFAULT_MAX_REDIRECTS = 3;

const MAX_URL_LENGTH = 2048;

export type UpdateSourceFailure =
  | "blocked_address"
  | "http_error"
  | "invalid_json"
  | "invalid_url"
  | "network"
  | "timeout"
  | "too_large"
  | "too_many_redirects";

export class UpdateSourceError extends Error {
  constructor(reason: UpdateSourceFailure, detail?: string) {
    super(`Update source rejected: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "UpdateSourceError";
    this.reason = reason;
    this.detail = detail ?? null;
  }

  readonly detail: null | string;
  readonly reason: UpdateSourceFailure;
}

export interface UpdateSourceTransportResponse {
  body: AsyncIterable<Uint8Array>;
  contentLength: null | number;
  destroy: () => void;
  etag: null | string;
  lastModified: null | string;
  location: null | string;
  status: number;
}

/**
 * The network seam. The default sends a plain GET over HTTPS with only the
 * headers it is given - never a cookie or an authorization header, since
 * nothing of the request that triggered the check is passed down here.
 */
export type UpdateSourceTransport = (
  url: URL,
  options: {
    headers: Record<string, string>;
    lookup: LookupFunction;
    signal: AbortSignal;
  },
) => Promise<UpdateSourceTransportResponse>;

export type ResolveUpdateHost = (hostname: string) => Promise<string[]>;

const header = (value: string | string[] | undefined): null | string =>
  (Array.isArray(value) ? value[0] : value) ?? null;

export const httpsUpdateSourceTransport: UpdateSourceTransport = async (
  url,
  { headers, lookup, signal },
) =>
  await new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      { agent: false, headers, lookup, method: "GET", signal },
      response => {
        const length = Number(response.headers["content-length"]);
        signal.addEventListener("abort", () => response.destroy(), {
          once: true,
        });

        resolve({
          body: response,
          contentLength: Number.isFinite(length) ? length : null,
          destroy: () => response.destroy(),
          etag: header(response.headers.etag),
          lastModified: header(response.headers["last-modified"]),
          location: header(response.headers.location),
          status: response.statusCode ?? 0,
        });
      },
    );

    request.on("error", reject);
    request.end();
  });

const resolveHostAddresses: ResolveUpdateHost = async hostname =>
  await new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) {
        reject(new UpdateSourceError("network", "DNS lookup failed"));

        return;
      }

      resolve(addresses.map(entry => entry.address));
    });
  });

const parseUrl = (raw: string, base?: URL): URL => {
  if (raw.length > MAX_URL_LENGTH) throw new UpdateSourceError("invalid_url");

  try {
    return new URL(raw, base);
  } catch {
    throw new UpdateSourceError("invalid_url");
  }
};

/**
 * HTTPS on the default port, a public host name, and every address it resolves
 * to public too. The same check runs again at connect time through
 * `publicOnlyLookup`, so a name that changes its answer in between still cannot
 * reach loopback, a private network or a cloud metadata endpoint.
 */
const assertFetchableUrl = async (
  url: URL,
  resolveHost: ResolveUpdateHost,
): Promise<void> => {
  if (url.protocol !== "https:") {
    throw new UpdateSourceError("invalid_url", "not https");
  }
  if (url.username || url.password) throw new UpdateSourceError("invalid_url");
  if (url.port && url.port !== "443") {
    throw new UpdateSourceError("invalid_url", "only port 443 is allowed");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) !== 0) {
    if (!isPublicIpAddress(hostname)) {
      throw new UpdateSourceError("blocked_address");
    }

    return;
  }
  if (!hostname.includes(".") || hostname.endsWith(".localhost")) {
    throw new UpdateSourceError("blocked_address");
  }

  const addresses = await resolveHost(hostname);
  if (
    addresses.length === 0 ||
    addresses.some(address => !isPublicIpAddress(address))
  ) {
    throw new UpdateSourceError("blocked_address");
  }
};

const readCapped = async (
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new UpdateSourceError("too_large");
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

const transportFailure = (
  error: unknown,
  signal: AbortSignal,
  cancel: AbortSignal | undefined,
): unknown => {
  // The caller gave up on the check - not something the publisher did, so the
  // caller's own reason goes back instead of a failure it would record.
  if (cancel?.aborted) return cancel.reason;
  if (error instanceof UpdateSourceError) return error;
  if (signal.aborted) return new UpdateSourceError("timeout");
  if (
    typeof error === "object" &&
    error !== null &&
    "reason" in error &&
    error.reason === "blocked_address"
  ) {
    return new UpdateSourceError("blocked_address");
  }

  return new UpdateSourceError("network");
};

export interface UpdateSourceValidators {
  etag: null | string;
  lastModified: null | string;
}

export type UpdateSourceFetchResult =
  | (UpdateSourceValidators & { body: unknown; kind: "fetched" })
  | { kind: "not_modified" };

export interface FetchUpdateSourceOptions {
  maxBytes?: number;
  maxRedirects?: number;
  resolveHost?: ResolveUpdateHost;
  /** Aborting it stops the request and rejects with the signal's own reason, never an {@link UpdateSourceError}. */
  signal?: AbortSignal;
  timeoutMs?: number;
  transport?: UpdateSourceTransport;
  /** Sent as `If-None-Match` / `If-Modified-Since`. Only pass them when a validated copy is stored. */
  validators?: null | UpdateSourceValidators;
}

export const fetchUpdateSource = async (
  rawUrl: string,
  {
    maxBytes = UPDATE_SOURCE_MAX_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    resolveHost = resolveHostAddresses,
    signal: cancel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    transport = httpsUpdateSourceTransport,
    validators = null,
  }: FetchUpdateSourceOptions = {},
): Promise<UpdateSourceFetchResult> => {
  cancel?.throwIfAborted();
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal =
    cancel === undefined ? timeout : AbortSignal.any([timeout, cancel]);
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "VitNode update check",
  };
  if (validators?.etag) headers["if-none-match"] = validators.etag;
  if (validators?.lastModified) {
    headers["if-modified-since"] = validators.lastModified;
  }

  let url = parseUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertFetchableUrl(url, resolveHost);
    if (signal.aborted) throw transportFailure(null, signal, cancel);

    let response: UpdateSourceTransportResponse;
    try {
      response = await transport(url, {
        headers,
        lookup: publicOnlyLookup,
        signal,
      });
    } catch (error) {
      throw transportFailure(error, signal, cancel);
    }

    if (response.status === 304) {
      response.destroy();
      if (!headers["if-none-match"] && !headers["if-modified-since"]) {
        throw new UpdateSourceError(
          "http_error",
          "304 without a request for it",
        );
      }

      return { kind: "not_modified" };
    }

    if (response.status >= 300 && response.status < 400) {
      response.destroy();
      if (!response.location) {
        throw new UpdateSourceError("http_error", String(response.status));
      }
      url = parseUrl(response.location, url);
      continue;
    }

    if (response.status !== 200) {
      response.destroy();
      throw new UpdateSourceError("http_error", String(response.status));
    }

    if (response.contentLength !== null && response.contentLength > maxBytes) {
      response.destroy();
      throw new UpdateSourceError("too_large");
    }

    let bytes: Uint8Array;
    try {
      bytes = await readCapped(response.body, maxBytes);
    } catch (error) {
      response.destroy();
      throw transportFailure(error, signal, cancel);
    }

    let body: unknown;
    try {
      body = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new UpdateSourceError("invalid_json");
    }

    return {
      body,
      etag: response.etag,
      kind: "fetched",
      lastModified: response.lastModified,
    };
  }

  throw new UpdateSourceError("too_many_redirects");
};
