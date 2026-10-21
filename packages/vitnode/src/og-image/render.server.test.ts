import type { Context } from "hono";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import type { CacheModel } from "@/api/lib/cache";

import { createTestCache } from "@/tests/cache";

import type { ResolvedOgImagesConfig } from "./config";
import type { OgImageRenderInput } from "./render.server";
import type { OgImagesConfig } from "./types";

import { resolveOgImagesConfig } from "./config";
import { defaultOgImageTemplate } from "./default-template";
import {
  OG_IMAGE_PUBLIC_CACHE_CONTROL,
  ogImageResponse,
  prepareOgImage,
} from "./render.server";

const PLUGIN = "@vitnode/blog";

const configOf = (config: OgImagesConfig = {}): ResolvedOgImagesConfig => {
  const resolved = resolveOgImagesConfig(config);
  if (!resolved) throw new Error("Expected a resolved config.");

  return resolved;
};

const BASE_CONFIG: OgImagesConfig = {
  templates: {
    article: { render: defaultOgImageTemplate.render, version: "1" },
  },
};

const contextOf = ({
  config = configOf(BASE_CONFIG),
  plugin = PLUGIN,
}: {
  config?: null | ResolvedOgImagesConfig;
  plugin?: string;
} = {}): Context =>
  ({
    get: (key: string) => {
      if (key === "core")
        return { metadata: { title: "VitNode" }, ogImages: config };
      if (key === "plugin") return { id: plugin };

      return undefined;
    },
  }) as unknown as Context;

const INPUT: OgImageRenderInput = {
  cover: { fileId: 10 },
  description: "A short summary",
  locale: "en",
  template: "article",
  title: "Hello world",
  url: "https://example.com/blog/hello-world",
};

const IDENTITY = ["content", "blog.post", "42"];

const keyOf = (
  input: Partial<OgImageRenderInput> = {},
  {
    context = contextOf(),
    identity = IDENTITY,
  }: { context?: Context; identity?: readonly unknown[] } = {},
) => prepareOgImage(context, { ...INPUT, ...input }, { identity }).key;

describe("prepareOgImage cache key", () => {
  it("is the same for the same image", () => {
    expect(keyOf()).toBe(keyOf());
  });

  it("ignores whitespace the image would not show", () => {
    expect(keyOf({ title: "  Hello \n world " })).toBe(keyOf());
  });

  it.each<[string, () => string]>([
    ["title", () => keyOf({ title: "Hello there" })],
    ["description", () => keyOf({ description: "Another summary" })],
    ["locale", () => keyOf({ locale: "pl" })],
    ["cover file", () => keyOf({ cover: { fileId: 11 } })],
    ["cover removed", () => keyOf({ cover: null })],
    ["cover source", () => keyOf({ cover: { url: "https://cdn.test/a.png" } })],
    ["canonical URL", () => keyOf({ url: "https://example.com/other" })],
    ["template id", () => keyOf({ template: "default" })],
    [
      "template version",
      () =>
        keyOf(
          {},
          {
            context: contextOf({
              config: configOf({
                templates: {
                  article: {
                    render: defaultOgImageTemplate.render,
                    version: "2",
                  },
                },
              }),
            }),
          },
        ),
    ],
    [
      "config version",
      () =>
        keyOf(
          {},
          {
            context: contextOf({
              config: configOf({ ...BASE_CONFIG, version: "2" }),
            }),
          },
        ),
    ],
    ["record", () => keyOf({}, { identity: ["content", "blog.post", "43"] })],
    [
      "plugin",
      () => keyOf({}, { context: contextOf({ plugin: "@acme/shop" }) }),
    ],
  ])("changes with the %s", (_label, changed) => {
    expect(changed()).not.toBe(keyOf());
  });

  it("draws an unknown template as the default one, under the default's key", () => {
    const prepared = prepareOgImage(
      contextOf(),
      { ...INPUT, template: "removed" },
      { identity: IDENTITY },
    );

    expect(prepared.templateId).toBe("default");
    expect(prepared.key).toBe(keyOf({ template: "default" }));
  });
});

describe("prepareOgImage refusals", () => {
  it.each<[string, Context, Partial<OgImageRenderInput>, boolean, number]>([
    ["images are off", contextOf({ config: null }), {}, false, 404],
    ["there is no title", contextOf(), { title: " " }, false, 404],
    [
      "a strict template is unknown",
      contextOf(),
      { template: "removed" },
      true,
      400,
    ],
  ])("answers when %s", (_label, context, input, strictTemplate, status) => {
    let thrown: unknown;
    try {
      prepareOgImage(
        context,
        { ...INPUT, ...input },
        { identity: IDENTITY, strictTemplate },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HTTPException);
    expect((thrown as HTTPException).status).toBe(status);
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** An app whose Redis already holds the image, so nothing is drawn. */
const appWithCachedImage = async (cacheControl?: string) => {
  const cache: CacheModel = createTestCache();
  const key = keyOf();
  await cache.setSystem(`og-image:${key}`, Buffer.from(PNG).toString("base64"));

  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("cache", cache);
    c.set("core", contextOf().get("core"));
    c.set("plugin", { id: PLUGIN });
    await next();
  });
  app.get(
    "/og",
    async c =>
      await ogImageResponse(c, {
        ...INPUT,
        ...(cacheControl ? { cacheControl } : {}),
        identity: IDENTITY,
      }),
  );

  return { app, etag: `"og-${key.slice(0, 32)}"` };
};

describe("ogImageResponse", () => {
  it("serves a cached PNG with its ETag and public cache headers", async () => {
    const { app, etag } = await appWithCachedImage();

    const response = await app.request("/og");

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(PNG);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "cache-control": OG_IMAGE_PUBLIC_CACHE_CONTROL,
      "content-length": String(PNG.byteLength),
      "content-type": "image/png",
      etag,
      "x-content-type-options": "nosniff",
      "x-vitnode-og-cache": "hit",
    });
  });

  it("keeps a caller's Cache-Control", async () => {
    const { app } = await appWithCachedImage("private, no-store");

    expect((await app.request("/og")).headers.get("cache-control")).toBe(
      "private, no-store",
    );
  });

  it.each([
    ["the ETag", (etag: string) => etag],
    ["a weak ETag", (etag: string) => `W/${etag}`],
    ["one ETag of several", (etag: string) => `"og-other", ${etag}`],
  ])("answers 304 to %s", async (_label, header) => {
    const { app, etag } = await appWithCachedImage();

    const response = await app.request("/og", {
      headers: { "If-None-Match": header(etag) },
    });

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(etag);
  });

  it("serves the image to a stale ETag", async () => {
    const { app } = await appWithCachedImage();

    const response = await app.request("/og", {
      headers: { "If-None-Match": '"og-stale"' },
    });

    expect(response.status).toBe(200);
  });
});
