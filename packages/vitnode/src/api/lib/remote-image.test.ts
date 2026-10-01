// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { RemoteImageResponse, RemoteImageTransport } from "./remote-image";

import {
  downloadRemoteImage,
  httpsImageTransport,
  isPublicIpAddress,
  publicOnlyLookup,
  REMOTE_IMAGE_MAX_BYTES,
  RemoteImageError,
  sniffImageMimeType,
} from "./remote-image";

const png = (width: number, height: number, extra = 0): Uint8Array => {
  const bytes = new Uint8Array(33 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);

  return bytes;
};

const reply = (
  status: number,
  {
    body = new Uint8Array(),
    contentLength = null,
    location = null,
  }: {
    body?: Uint8Array;
    contentLength?: null | number;
    location?: null | string;
  } = {},
): RemoteImageResponse => ({
  body: (async function* chunks() {
    await Promise.resolve();
    yield body;
  })(),
  contentLength,
  destroy: () => undefined,
  location,
  status,
});

const PUBLIC_HOSTS: Record<string, string[]> = {
  "cdn.discordapp.com": ["162.159.130.233"],
  "lh3.googleusercontent.com": ["142.250.186.65"],
  "rebind.example.com": ["10.0.0.5"],
  "mixed.example.com": ["142.250.186.65", "127.0.0.1"],
};

const resolveHost = async (hostname: string) =>
  Promise.resolve(PUBLIC_HOSTS[hostname] ?? []);

const download = async (
  url: string,
  transport: RemoteImageTransport,
  maxBytes = 1024 * 1024,
) => await downloadRemoteImage(url, { maxBytes, resolveHost, transport });

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RemoteImageError) return error.reason;
    throw error;
  }

  return "resolved";
};

describe("telling public addresses from private ones", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("refuses %s", address => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["142.250.186.65", "162.159.130.233", "2606:4700::6810:84e5"])(
    "accepts %s",
    address => {
      expect(isPublicIpAddress(address)).toBe(true);
    },
  );
});

describe("downloading a provider avatar", () => {
  it("returns the bytes of a real image with its sniffed type", async () => {
    const image = await download(
      "https://lh3.googleusercontent.com/a/photo",
      async () => Promise.resolve(reply(200, { body: png(96, 96) })),
    );

    expect(image).toMatchObject({
      height: 96,
      mimeType: "image/png",
      width: 96,
    });
  });

  it("only speaks https", async () => {
    const transport = vi.fn<RemoteImageTransport>();

    expect(
      await failure(download("http://lh3.googleusercontent.com/a", transport)),
    ).toBe("invalid_url");
    expect(await failure(download("file:///etc/passwd", transport))).toBe(
      "invalid_url",
    );
    expect(
      await failure(
        download("https://user:pass@lh3.googleusercontent.com/a", transport),
      ),
    ).toBe("invalid_url");
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "https://127.0.0.1/avatar.png",
    "https://[::1]/avatar.png",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/avatar.png",
    "https://rebind.example.com/avatar.png",
    "https://mixed.example.com/avatar.png",
    "https://unknown.example.com/avatar.png",
  ])("never connects to %s", async url => {
    const transport = vi.fn<RemoteImageTransport>();

    expect(await failure(download(url, transport))).toBe("blocked_address");
    expect(transport).not.toHaveBeenCalled();
  });

  it("re-checks every redirect, and refuses one into the private network", async () => {
    const transport = vi.fn<RemoteImageTransport>(async () =>
      Promise.resolve(
        reply(302, { location: "https://169.254.169.254/latest/meta-data" }),
      ),
    );

    expect(
      await failure(
        download("https://cdn.discordapp.com/avatars/1/a.png", transport),
      ),
    ).toBe("blocked_address");
    expect(transport).toHaveBeenCalledOnce();
  });

  it("follows a public redirect", async () => {
    const transport = vi
      .fn<RemoteImageTransport>()
      .mockResolvedValueOnce(reply(301, { location: "/a/photo-large" }))
      .mockResolvedValueOnce(reply(200, { body: png(512, 512) }));

    const image = await download(
      "https://lh3.googleusercontent.com/a/photo",
      transport,
    );

    expect(image.width).toBe(512);
    expect(transport.mock.calls[1]?.[0].href).toBe(
      "https://lh3.googleusercontent.com/a/photo-large",
    );
  });

  it("gives up after a few redirects", async () => {
    const transport = vi.fn<RemoteImageTransport>(async () =>
      Promise.resolve(reply(302, { location: "/again" })),
    );

    expect(
      await failure(download("https://lh3.googleusercontent.com/a", transport)),
    ).toBe("too_many_redirects");
  });

  it("refuses a body over the limit, whether announced or streamed", async () => {
    expect(
      await failure(
        download(
          "https://lh3.googleusercontent.com/a",
          async () =>
            Promise.resolve(
              reply(200, { body: png(1, 1), contentLength: 5000 }),
            ),
          1000,
        ),
      ),
    ).toBe("too_large");
    expect(
      await failure(
        download(
          "https://lh3.googleusercontent.com/a",
          async () => Promise.resolve(reply(200, { body: png(1, 1, 2000) })),
          1000,
        ),
      ),
    ).toBe("too_large");
  });

  it("never allows more than the hard cap, whatever the role allows", async () => {
    const transport = async () =>
      Promise.resolve(
        reply(200, {
          body: png(1, 1),
          contentLength: REMOTE_IMAGE_MAX_BYTES + 1,
        }),
      );

    expect(
      await failure(
        download(
          "https://lh3.googleusercontent.com/a",
          transport,
          REMOTE_IMAGE_MAX_BYTES * 10,
        ),
      ),
    ).toBe("too_large");
  });

  it("refuses content that is not a JPEG, PNG or WebP, whatever it claims to be", async () => {
    const html = new TextEncoder().encode("<html>not an image</html>");

    expect(
      await failure(
        download("https://lh3.googleusercontent.com/a", async () =>
          Promise.resolve(reply(200, { body: html })),
        ),
      ),
    ).toBe("unsupported_type");
  });

  it("refuses an image too large to process", async () => {
    expect(
      await failure(
        download("https://lh3.googleusercontent.com/a", async () =>
          Promise.resolve(reply(200, { body: png(20_000, 20_000) })),
        ),
      ),
    ).toBe("unsupported_type");
  });

  it("reports a failed response as an error rather than an image", async () => {
    expect(
      await failure(
        download("https://lh3.googleusercontent.com/a", async () =>
          Promise.resolve(reply(404)),
        ),
      ),
    ).toBe("http_error");
    expect(
      await failure(
        download("https://lh3.googleusercontent.com/a", async () =>
          Promise.reject(new Error("socket hang up")),
        ),
      ),
    ).toBe("network");
  });
});

describe("sniffing an image type", () => {
  it("reads the magic bytes", () => {
    expect(sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(sniffImageMimeType(png(1, 1))).toBe("image/png");
    expect(
      sniffImageMimeType(
        new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "),
      ),
    ).toBe("image/webp");
    expect(sniffImageMimeType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("the connection-time address check", () => {
  it("refuses to connect when the name resolves to a private address at connect time", async () => {
    const error = await new Promise<unknown>(resolve => {
      publicOnlyLookup("localhost", {}, lookupError => {
        resolve(lookupError);
      });
    });

    expect(error).toBeInstanceOf(RemoteImageError);
    expect((error as RemoteImageError).reason).toBe("blocked_address");
  });

  it("stops the real transport even when the pre-check was fooled", async () => {
    const reason = await failure(
      downloadRemoteImage("https://localhost.example.test/avatar.png", {
        maxBytes: 1024,
        resolveHost: async () => Promise.resolve(["142.250.186.65"]),
        transport: async (url, options) =>
          await httpsImageTransport(new URL("https://localhost/avatar.png"), {
            ...options,
            signal: AbortSignal.timeout(2000),
          }),
      }),
    );

    expect(reason).toBe("blocked_address");
  });
});
