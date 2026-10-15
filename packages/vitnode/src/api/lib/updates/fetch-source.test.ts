import { describe, expect, it, vi } from "vitest";

import type {
  FetchUpdateSourceOptions,
  UpdateSourceTransport,
  UpdateSourceTransportResponse,
} from "./fetch-source";

import { fetchUpdateSource } from "./fetch-source";

const MANIFEST = { packages: {}, schemaVersion: 1 };

const reply = (
  status: number,
  {
    body = new Uint8Array(),
    contentLength = null,
    destroy = () => undefined,
    etag = null,
    lastModified = null,
    location = null,
  }: Partial<Omit<UpdateSourceTransportResponse, "body">> & {
    body?: Uint8Array;
  } = {},
): UpdateSourceTransportResponse => ({
  body: (async function* chunks() {
    await Promise.resolve();
    yield body;
  })(),
  contentLength,
  destroy,
  etag,
  lastModified,
  location,
  status,
});

const json = (value: unknown, extra: Parameters<typeof reply>[1] = {}) =>
  reply(200, {
    body: new TextEncoder().encode(JSON.stringify(value)),
    ...extra,
  });

const HOSTS: Record<string, string[]> = {
  "cdn.example.com": ["93.184.215.14"],
  "mixed.example.com": ["93.184.215.14", "10.0.0.5"],
  "private.example.com": ["192.168.1.10"],
  "updates.example.com": ["93.184.215.14"],
};

const resolveHost = async (hostname: string) =>
  await Promise.resolve(HOSTS[hostname] ?? []);

/** A transport that answers each request in turn, and records what was asked. */
const scripted = (...responses: UpdateSourceTransportResponse[]) => {
  const requests: { headers: Record<string, string>; url: string }[] = [];
  const transport: UpdateSourceTransport = async (url, { headers }) => {
    requests.push({ headers, url: url.href });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");

    return await Promise.resolve(next);
  };

  return { requests, transport };
};

const fetchWith = async (
  url: string,
  transport: UpdateSourceTransport,
  options: Omit<FetchUpdateSourceOptions, "resolveHost" | "transport"> = {},
) => await fetchUpdateSource(url, { resolveHost, transport, ...options });

const URL_OK = "https://updates.example.com/updates.json";

describe("fetchUpdateSource", () => {
  it("returns the JSON body and its validators, sending no cookie or authorization", async () => {
    const { requests, transport } = scripted(
      json(MANIFEST, {
        etag: '"v1"',
        lastModified: "Wed, 14 Oct 2026 10:00:00 GMT",
      }),
    );

    await expect(fetchWith(URL_OK, transport)).resolves.toEqual({
      body: MANIFEST,
      etag: '"v1"',
      kind: "fetched",
      lastModified: "Wed, 14 Oct 2026 10:00:00 GMT",
    });
    expect(requests).toEqual([
      {
        headers: {
          accept: "application/json",
          "user-agent": "VitNode update check",
        },
        url: URL_OK,
      },
    ]);
  });

  it("asks conditionally when validators are given, and reads a 304 as not modified", async () => {
    const { requests, transport } = scripted(reply(304));

    await expect(
      fetchWith(URL_OK, transport, {
        validators: {
          etag: '"v1"',
          lastModified: "Wed, 14 Oct 2026 10:00:00 GMT",
        },
      }),
    ).resolves.toEqual({ kind: "not_modified" });
    expect(requests[0]?.headers).toMatchObject({
      "if-modified-since": "Wed, 14 Oct 2026 10:00:00 GMT",
      "if-none-match": '"v1"',
    });
  });

  it("refuses a 304 it did not ask for", async () => {
    const { transport } = scripted(reply(304));

    await expect(fetchWith(URL_OK, transport)).rejects.toMatchObject({
      reason: "http_error",
    });
  });

  it.each([
    ["http", "http://updates.example.com/updates.json", "invalid_url"],
    [
      "a port other than 443",
      "https://updates.example.com:8443/u.json",
      "invalid_url",
    ],
    [
      "credentials",
      "https://acme:secret@updates.example.com/u.json",
      "invalid_url",
    ],
    ["not a URL", "updates.json", "invalid_url"],
    ["loopback", "https://127.0.0.1/updates.json", "blocked_address"],
    ["IPv6 loopback", "https://[::1]/updates.json", "blocked_address"],
    ["a private network", "https://10.1.2.3/updates.json", "blocked_address"],
    [
      "the cloud metadata endpoint",
      "https://169.254.169.254/latest",
      "blocked_address",
    ],
    ["a single-label host", "https://intranet/updates.json", "blocked_address"],
    [
      "a .localhost host",
      "https://app.localhost/updates.json",
      "blocked_address",
    ],
    [
      "a host resolving to a private address",
      "https://private.example.com/u.json",
      "blocked_address",
    ],
    [
      "a host resolving to a private address among public ones",
      "https://mixed.example.com/u.json",
      "blocked_address",
    ],
    [
      "a host that does not resolve",
      "https://nowhere.example.com/u.json",
      "blocked_address",
    ],
  ])("refuses %s without connecting", async (_, url, reason) => {
    const transport = vi.fn<UpdateSourceTransport>();

    await expect(fetchWith(url, transport)).rejects.toMatchObject({ reason });
    expect(transport).not.toHaveBeenCalled();
  });

  it("follows a relative redirect on the same host", async () => {
    const { requests, transport } = scripted(
      reply(302, { location: "/v2/updates.json" }),
      json(MANIFEST),
    );

    await expect(fetchWith(URL_OK, transport)).resolves.toMatchObject({
      body: MANIFEST,
    });
    expect(requests.map(request => request.url)).toEqual([
      URL_OK,
      "https://updates.example.com/v2/updates.json",
    ]);
  });

  it.each([
    ["a private host", "https://private.example.com/u.json", "blocked_address"],
    [
      "the cloud metadata endpoint",
      "https://169.254.169.254/latest",
      "blocked_address",
    ],
    ["http", "http://cdn.example.com/u.json", "invalid_url"],
  ])("refuses a redirect to %s", async (_, location, reason) => {
    const { requests, transport } = scripted(reply(301, { location }));

    await expect(fetchWith(URL_OK, transport)).rejects.toMatchObject({
      reason,
    });
    expect(requests).toHaveLength(1);
  });

  it("stops after the redirect limit", async () => {
    const { requests, transport } = scripted(
      reply(302, { location: "/1" }),
      reply(302, { location: "/2" }),
      reply(302, { location: "/3" }),
    );

    await expect(
      fetchWith(URL_OK, transport, { maxRedirects: 2 }),
    ).rejects.toMatchObject({ reason: "too_many_redirects" });
    expect(requests).toHaveLength(3);
  });

  it.each([
    ["a redirect without a location", reply(302), "302"],
    ["a server error", reply(503), "503"],
    ["a missing manifest", reply(404), "404"],
  ])("reports %s as an HTTP error", async (_, response, detail) => {
    const { transport } = scripted(response);

    await expect(fetchWith(URL_OK, transport)).rejects.toMatchObject({
      detail,
      reason: "http_error",
    });
  });

  it("refuses a declared size over the limit before reading the body", async () => {
    const destroy = vi.fn();
    const { transport } = scripted(reply(200, { contentLength: 11, destroy }));

    await expect(
      fetchWith(URL_OK, transport, { maxBytes: 10 }),
    ).rejects.toMatchObject({ reason: "too_large" });
    expect(destroy).toHaveBeenCalled();
  });

  it("stops reading a body that grows past the limit without declaring its size", async () => {
    const destroy = vi.fn();
    const { transport } = scripted(
      reply(200, { body: new Uint8Array(11), destroy }),
    );

    await expect(
      fetchWith(URL_OK, transport, { maxBytes: 10 }),
    ).rejects.toMatchObject({ reason: "too_large" });
    expect(destroy).toHaveBeenCalled();
  });

  it.each([
    ["text that is not JSON", new TextEncoder().encode("<html>")],
    ["bytes that are not UTF-8", new Uint8Array([0x7b, 0xff, 0x7d])],
  ])("reports %s as invalid JSON", async (_, body) => {
    const { transport } = scripted(reply(200, { body }));

    await expect(fetchWith(URL_OK, transport)).rejects.toMatchObject({
      reason: "invalid_json",
    });
  });

  it("times out a server that never answers", async () => {
    const transport: UpdateSourceTransport = async (_, { signal }) =>
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(signal.reason as Error);
        });
      });

    await expect(
      fetchWith(URL_OK, transport, { timeoutMs: 5 }),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("times out a body that stalls", async () => {
    const transport: UpdateSourceTransport = async (_, { signal }) =>
      await Promise.resolve({
        ...reply(200),
        body: (async function* stalled() {
          yield new TextEncoder().encode("{");
          await new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(signal.reason as Error);
            });
          });
        })(),
      });

    await expect(
      fetchWith(URL_OK, transport, { timeoutMs: 5 }),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it.each([
    [
      "a connection the connect-time lookup blocked",
      Object.assign(new Error("blocked"), { reason: "blocked_address" }),
      "blocked_address",
    ],
    ["a refused connection", new Error("ECONNREFUSED"), "network"],
  ])("reports %s", async (_, error, reason) => {
    const transport: UpdateSourceTransport = async () =>
      await Promise.reject(error);

    await expect(fetchWith(URL_OK, transport)).rejects.toMatchObject({
      reason,
    });
  });
});
