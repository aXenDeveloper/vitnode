import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "../middlewares/global.middleware";

import { StorageModel } from "../models/storage";
import { attachStoredFile } from "./file-download";

const STORAGE_URL = "https://storage.example/bucket/key-1";

const getUrl = vi.fn(() => STORAGE_URL);

/** The parts of the request context this helper is allowed to touch. */
const context = () => {
  const headers = new Headers();
  const c = {
    body: (body: BodyInit, status: number) =>
      new Response(body, { headers, status }),
    get: (key: string) => {
      if (key === "core") return { storage: { adapter: { getUrl } } };
      if (key === "storage") return new StorageModel(c);

      return undefined;
    },
    header: (name: string, value: string) => headers.set(name, value),
  } as unknown as Context<EnvVitNode>;

  return { context: c, headers };
};

const upstreamFetch = vi.fn<(url: string) => Promise<Response>>();

const answers = (body: BodyInit | null, init?: ResponseInit) => {
  upstreamFetch.mockImplementation(
    async () => await Promise.resolve(new Response(body, init)),
  );
};

const FILE = { key: "key-1", mimeType: "image/png", name: "photo.png" };

beforeEach(() => {
  upstreamFetch.mockReset();
  getUrl.mockClear();
  answers("bytes", { status: 200 });
  vi.stubGlobal("fetch", upstreamFetch);
});

describe("fetching the object", () => {
  it("reads it from the storage adapter's own URL", async () => {
    const { context: c } = context();

    await attachStoredFile(c, FILE);

    expect(getUrl).toHaveBeenCalledWith("key-1");
    expect(upstreamFetch).toHaveBeenCalledWith(STORAGE_URL);
  });

  it("hands back the bytes as they arrived", async () => {
    const { context: c } = context();

    const response = await attachStoredFile(c, FILE);

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("bytes");
  });

  it.each([404, 403, 500, 301])(
    "refuses a %i from storage, leaving the 404 to the route",
    async status => {
      answers("", { status });
      const { context: c } = context();

      await expect(attachStoredFile(c, FILE)).resolves.toBeNull();
    },
  );

  it("refuses an answer that carries no body at all", async () => {
    answers(null, { status: 200 });
    const { context: c } = context();

    await expect(attachStoredFile(c, FILE)).resolves.toBeNull();
  });

  it("sets no header on a refusal", async () => {
    answers("", { status: 404 });
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect([...headers.keys()]).toEqual([]);
  });
});

describe("the content type", () => {
  it("is the file's own", async () => {
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect(headers.get("Content-Type")).toBe("image/png");
  });

  it("falls back to an opaque stream when the file has none", async () => {
    const { context: c, headers } = context();

    await attachStoredFile(c, { ...FILE, mimeType: null });

    expect(headers.get("Content-Type")).toBe("application/octet-stream");
  });
});

describe("the attachment name", () => {
  it("is the original file name", async () => {
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect(headers.get("Content-Disposition")).toBe(
      "attachment; filename*=UTF-8''photo.png",
    );
  });

  it("is always an attachment, never rendered inline", async () => {
    const { context: c, headers } = context();

    await attachStoredFile(c, { ...FILE, mimeType: "text/html" });

    expect(headers.get("Content-Disposition")).toMatch(/^attachment;/);
  });

  it.each([
    ['a "quoted" name.png', "a%20%22quoted%22%20name.png"],
    ["semi;colon.png", "semi%3Bcolon.png"],
    ["with space.png", "with%20space.png"],
    ["../../etc/passwd", "..%2F..%2Fetc%2Fpasswd"],
    ["nowy plik ąęć.png", "nowy%20plik%20%C4%85%C4%99%C4%87.png"],
  ])(
    "percent-encodes %o so the header cannot be broken",
    async (name, encoded) => {
      const { context: c, headers } = context();

      await attachStoredFile(c, { ...FILE, name });

      expect(headers.get("Content-Disposition")).toBe(
        `attachment; filename*=UTF-8''${encoded}`,
      );
    },
  );
});

describe("the content length", () => {
  it("is forwarded when storage reported one", async () => {
    answers("bytes", { headers: { "content-length": "5" }, status: 200 });
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect(headers.get("Content-Length")).toBe("5");
  });

  it("is left off when storage reported none", async () => {
    answers(new ReadableStream(), { status: 200 });
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect(headers.has("Content-Length")).toBe(false);
  });

  it("forwards a reported zero, which is a length and not an absence", async () => {
    // `"0"` is a non-empty string, so the guard lets it through - the same
    // answer the routes gave before they shared this helper.
    answers("", { headers: { "content-length": "0" }, status: 200 });
    const { context: c, headers } = context();

    await attachStoredFile(c, FILE);

    expect(headers.get("Content-Length")).toBe("0");
  });
});
