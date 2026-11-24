import type { PageCacheStore } from "@vitnode/api/page-cache/store.server";

import {
  contentDeliverySitemapTag,
  contentPublicItemTag,
  contentPublicListTag,
} from "@vitnode/api/content/cache";
import {
  CONTENT_REVALIDATE_PATH,
  CONTENT_REVALIDATE_TIMESTAMP_HEADER,
} from "@vitnode/api/content/server/revalidate-bridge";
import { INSECURE_DEFAULT_CRON_SECRET } from "@vitnode/api/lib/config";
import {
  configurePageCacheStore,
  createMemoryPageCacheStore,
  latestPageCacheInvalidation,
  resetPageCacheStore,
} from "@vitnode/api/page-cache/store.server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleContentRevalidation } from "./revalidate.server";

const SECRET = "test-revalidation-secret";
const TYPE = "blog.post";

let store: PageCacheStore;

const ensure = () => {
  configurePageCacheStore(store, { maxLifetime: 3600 });
};

const body = (overrides: Record<string, unknown> = {}) => ({
  contentTypeId: TYPE,
  delivery: { sitemap: { contentChanged: true, indexChanged: false } },
  id: 7,
  isPublic: false,
  mode: "immediate",
  slugs: ["hello"],
  wasPublic: true,
  ...overrides,
});

const post = async ({
  bearer = SECRET,
  payload = body(),
  sentAt = Date.now(),
}: {
  bearer?: null | string;
  payload?: unknown;
  sentAt?: number;
} = {}): Promise<number> => {
  const response = await handleContentRevalidation(
    new Request(new URL(CONTENT_REVALIDATE_PATH, "https://example.com"), {
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
      headers: {
        ...(bearer === null ? {} : { authorization: `Bearer ${bearer}` }),
        [CONTENT_REVALIDATE_TIMESTAMP_HEADER]: String(sentAt),
        "content-type": "application/json",
      },
      method: "POST",
    }),
    ensure,
  );

  return response.status;
};

const stamp = async (tag: string, mode: "hard" | "soft") =>
  await latestPageCacheInvalidation(store, [tag], mode);

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  store = createMemoryPageCacheStore();
  resetPageCacheStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetPageCacheStore();
});

describe("handleContentRevalidation", () => {
  it.each<[string, Parameters<typeof post>[0]]>([
    ["no bearer", { bearer: null }],
    ["a wrong bearer", { bearer: "not-the-secret" }],
    ["a stale timestamp", { sentAt: Date.now() - 6 * 60 * 1000 }],
    ["a timestamp from the future", { sentAt: Date.now() + 6 * 60 * 1000 }],
  ])("answers 403 to %s", async (_, request) => {
    expect(await post(request)).toBe(403);
    expect(await stamp(contentDeliverySitemapTag(TYPE), "hard")).toBe(0);
  });

  it("answers 403 while CRON_SECRET is still the insecure default", async () => {
    vi.stubEnv("CRON_SECRET", INSECURE_DEFAULT_CRON_SECRET);

    expect(await post({ bearer: INSECURE_DEFAULT_CRON_SECRET })).toBe(403);
  });

  it.each<[string, unknown]>([
    ["a body that is not JSON", "{not json"],
    ["an unknown mode", body({ mode: "later" })],
    ["a missing id", body({ id: undefined })],
    ["a malformed delivery", body({ delivery: { sitemap: true } })],
    ["malformed locales", body({ locales: [{ locale: "pl" }] })],
  ])("answers 400 to %s", async (_, payload) => {
    expect(await post({ payload })).toBe(400);
  });

  it("hard-invalidates only the sitemap tags for an immediate change", async () => {
    expect(await post()).toBe(204);

    expect(
      await stamp(contentDeliverySitemapTag(TYPE), "hard"),
    ).toBeGreaterThan(0);
    expect(await stamp(contentDeliverySitemapTag(TYPE), "soft")).toBe(0);
    for (const tag of [
      contentPublicListTag(TYPE),
      contentPublicItemTag(TYPE, 7),
    ]) {
      expect(await stamp(tag, "hard")).toBe(0);
      expect(await stamp(tag, "soft")).toBe(0);
    }
  });

  it("soft-invalidates a stale-while-revalidate change, per locale", async () => {
    expect(
      await post({
        payload: body({
          delivery: { sitemap: { contentChanged: true, indexChanged: false } },
          locales: [
            { isPublic: true, locale: "pl", slugs: ["witaj"], wasPublic: true },
          ],
          mode: "stale-while-revalidate",
        }),
      }),
    ).toBe(204);

    expect(
      await stamp(contentDeliverySitemapTag(TYPE, "pl"), "soft"),
    ).toBeGreaterThan(0);
    expect(await stamp(contentDeliverySitemapTag(TYPE, "pl"), "hard")).toBe(0);
    // The locale-less tag is the index of locale files: unchanged here.
    expect(await stamp(contentDeliverySitemapTag(TYPE), "soft")).toBe(0);
  });

  it("answers 204 without touching the store when no sitemap is affected", async () => {
    expect(await post({ payload: body({ delivery: undefined }) })).toBe(204);
    expect(await stamp(contentDeliverySitemapTag(TYPE), "hard")).toBe(0);
  });
});
