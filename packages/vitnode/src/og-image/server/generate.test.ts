import type { Context } from "hono";

import { beforeEach, describe, expect, it } from "vitest";

import type { ResolvedOgImagesConfig } from "./config";
import type { OgImageRequest } from "./generate";

import { OgImageLocalCache, ogImageLocalCache } from "./cache";
import { resolveOgImagesConfig } from "./config";
import { defaultOgImageTemplateEntry } from "./default-template";
import { generateOgImage } from "./generate";

const METADATA = { title: "VitNode Community" };

const resolved = (
  config: Parameters<typeof resolveOgImagesConfig>[0],
): ResolvedOgImagesConfig => {
  const result = resolveOgImagesConfig(config, METADATA);
  if (!result) throw new Error("Expected a resolved config.");

  return result;
};

const BASE_CONFIG = resolved({});

const contextWith = (ogImages: ResolvedOgImagesConfig): Context =>
  ({
    get: (key: string) =>
      key === "core" ? { i18n: { defaultLocale: "en" }, ogImages } : undefined,
  }) as unknown as Context;

const BASE: OgImageRequest = {
  cover: { bytes: new Uint8Array([1, 2, 3]) },
  description: "A short description",
  identity: ["generate.test"],
  locale: "en",
  title: "Hello world",
};

beforeEach(() => {
  ogImageLocalCache.clear();
});

describe("generateOgImage", () => {
  it("serves an identical request from the cache with the same ETag", async () => {
    const c = contextWith(BASE_CONFIG);

    const first = await generateOgImage(c, BASE);
    const second = await generateOgImage(c, BASE);

    expect(first.fromCache).toBe(false);
    expect(second).toStrictEqual({ ...first, fromCache: true });
  });

  it.each<[string, OgImageRequest, ResolvedOgImagesConfig]>([
    ["the title", { ...BASE, title: "Goodbye world" }, BASE_CONFIG],
    ["the description", { ...BASE, description: "Another one" }, BASE_CONFIG],
    [
      "the cover",
      { ...BASE, cover: { bytes: new Uint8Array([4, 5, 6]) } },
      BASE_CONFIG,
    ],
    ["the locale", { ...BASE, locale: "pl" }, BASE_CONFIG],
    [
      "the template version",
      BASE,
      resolved({
        templates: {
          default: { ...defaultOgImageTemplateEntry, version: "next" },
        },
      }),
    ],
    [
      "the install's branding",
      BASE,
      resolved({ branding: { siteName: "Renamed" } }),
    ],
  ])("renders anew when %s changes", async (_change, request, config) => {
    const before = await generateOgImage(contextWith(BASE_CONFIG), BASE);
    const after = await generateOgImage(contextWith(config), request);

    expect(after.fromCache).toBe(false);
    expect(after.etag).not.toBe(before.etag);
  });
});

describe("OgImageLocalCache", () => {
  const bytes = (length: number) => new Uint8Array(length);

  it("drops the least recently used card once over its byte bound", () => {
    const cache = new OgImageLocalCache(10);
    cache.set("a", bytes(4));
    cache.set("b", bytes(4));
    cache.get("a");
    cache.set("c", bytes(4));

    expect(cache.get("a")).not.toBeNull();
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).not.toBeNull();
    expect(cache.totalBytes).toBe(8);
  });

  it("never stores a card larger than the whole cache", () => {
    const cache = new OgImageLocalCache(10);
    cache.set("big", bytes(11));

    expect(cache.get("big")).toBeNull();
    expect(cache.totalBytes).toBe(0);
  });
});
