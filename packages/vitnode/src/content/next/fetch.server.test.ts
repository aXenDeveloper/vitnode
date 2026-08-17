// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testLocalizedPageContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

interface FetchArgs {
  module: string;
  options?: { cache?: string; next?: { tags?: string[] } };
  path: string;
  query?: Record<string, string | string[] | undefined>;
}

const calls = vi.hoisted(() => [] as FetchArgs[]);

// Throws outside a React Server Component, and this module carries it on
// purpose - see `boundaries.test.ts`.
vi.mock("server-only", () => ({}));

vi.mock("../../lib/fetcher/raw", () => ({
  rawApiFetch: async (args: FetchArgs) => {
    calls.push(args);

    return await Promise.resolve(
      new Response(JSON.stringify({ title: "Hello" }), { status: 200 }),
    );
  },
}));

const { contentInvalidationTags, contentPublicListTag } =
  await import("../cache");
const { contentPublicFetch, contentPublicItemTags } =
  await import("./fetch.server");

const LIST_TAG = "content:test.post:list";

const fetchOnce = async (slug?: string) => {
  await contentPublicFetch({
    definition: testPostContentType,
    pluginId: "@vitnode/example",
    slug,
  });

  const call = calls.at(-1);
  if (!call) throw new Error("Expected a request.");

  return call;
};

beforeEach(() => {
  calls.length = 0;
});

describe("caching", () => {
  it("opts into the persistent Data Cache explicitly", async () => {
    // Caching is opt-in in Next 16: without this the response is refetched on
    // every request as soon as the route touches a request-time API, and the
    // tags below expire something that was never stored.
    expect((await fetchOnce()).options?.cache).toBe("force-cache");
  });

  it("opts in on a detail fetch too", async () => {
    expect((await fetchOnce("hello-world")).options?.cache).toBe("force-cache");
  });
});

describe("tags", () => {
  it("tags a list fetch with the list tag", async () => {
    expect((await fetchOnce()).options?.next?.tags).toEqual([LIST_TAG]);
  });

  it("tags a detail fetch with its own slug tag", async () => {
    expect((await fetchOnce("hello-world")).options?.next?.tags).toEqual([
      "content:test.post:slug:hello-world",
    ]);
  });

  it("never puts the list tag on a detail fetch", async () => {
    // Publishing one post must not throw away every post page.
    expect((await fetchOnce("hello-world")).options?.next?.tags).not.toContain(
      LIST_TAG,
    );
  });
});

describe("path", () => {
  it("uses the configured public path", async () => {
    const call = await fetchOnce();

    expect(call.module).toBe("content/posts");
    expect(call.path).toBe("/");
  });

  it("appends the slug for a detail fetch", async () => {
    expect((await fetchOnce("hello-world")).path).toBe("/hello-world");
  });

  it("encodes a slug that is not URL-safe", async () => {
    // A generated slug never looks like this, but the argument is public API
    // and may come from anywhere.
    expect((await fetchOnce("a b/c?d#e")).path).toBe("/a%20b%2Fc%3Fd%23e");
  });

  it("leaves the module path alone while encoding the segment", async () => {
    // Encoding the whole URL would turn `content/posts` into `content%2Fposts`.
    expect((await fetchOnce("a/b")).module).toBe("content/posts");
  });
});

/**
 * A localized public response has a language whether the caller named one or
 * not, so its cache identity has to have the same one.
 *
 * The failure this guards against is silent and permanent: omitting `locale`
 * used to tag the response `content:x:list` while the API resolved the default
 * locale and returned English. Every invalidation path names the locale-aware
 * tag, so nothing would ever expire that entry - not a translation publish, not
 * an edit of the English copy, not a rebuild.
 */
describe("a localized content type", () => {
  const localizedFetch = async ({
    locale,
    slug,
  }: { locale?: string; slug?: string } = {}) => {
    await contentPublicFetch({
      definition: testLocalizedPageContentType,
      locale,
      pluginId: "@vitnode/example",
      slug,
    });

    const call = calls.at(-1);
    if (!call) throw new Error("Expected a request.");

    return call;
  };

  it("sends and tags the locale it was given", async () => {
    const call = await localizedFetch({ locale: "pl" });

    expect(call.query).toMatchObject({ locale: "pl" });
    expect(call.options?.next?.tags).toEqual([
      "content:test.localized-page:list:pl",
    ]);
  });

  it("fills in the default locale when the caller omits one", async () => {
    const call = await localizedFetch();

    // Both, from the same value: the API would have resolved `en` anyway, and
    // the point is that the tag says so too.
    expect(call.query).toMatchObject({ locale: "en" });
    expect(call.options?.next?.tags).toEqual([
      "content:test.localized-page:list:en",
    ]);
  });

  it("never produces a locale-less tag, on either route", async () => {
    const list = await localizedFetch();
    const detail = await localizedFetch({ slug: "about" });

    for (const tag of [
      ...(list.options?.next?.tags ?? []),
      ...(detail.options?.next?.tags ?? []),
    ]) {
      // Four segments, always. `content:x:list` and `content:x:slug:about` are
      // the shapes a translation publish can never reach.
      expect(tag.split(":").length).toBeGreaterThanOrEqual(4);
    }
  });

  it("tags a detail fetch per language, so two locales cannot share one", async () => {
    const english = await localizedFetch({ locale: "en", slug: "about" });
    const polish = await localizedFetch({ locale: "pl", slug: "about" });

    // The same slug in two languages is the ordinary case, not the odd one.
    expect(english.options?.next?.tags).toEqual([
      "content:test.localized-page:slug:en:about",
    ]);
    expect(polish.options?.next?.tags).toEqual([
      "content:test.localized-page:slug:pl:about",
    ]);
  });

  it("treats a blank locale as an omitted one", async () => {
    const call = await localizedFetch({ locale: "   " });

    // `""` would drop the segment inside the tag builder and produce exactly the
    // locale-less tag this whole rule exists to prevent.
    expect(call.query).toMatchObject({ locale: "en" });
    expect(call.options?.next?.tags).toEqual([
      "content:test.localized-page:list:en",
    ]);
  });

  it("produces tags a default-locale translation publish actually expires", () => {
    // The loop this whole rule closes. Publishing the English translation
    // invalidates the tags `contentInvalidationTags` names; a page fetched
    // without a `locale` has to be tagged with those same strings, or it stays
    // stale until something evicts it - which nothing would.
    const expired = contentInvalidationTags({
      contentTypeId: testLocalizedPageContentType.id,
      id: 7,
      isPublic: true,
      locales: [
        { isPublic: true, locale: "en", slugs: ["about"], wasPublic: true },
      ],
      slugs: ["about"],
      wasPublic: true,
    });

    expect(expired).toContain(
      contentPublicListTag(testLocalizedPageContentType.id, "en"),
    );
    expect(expired).toEqual(
      expect.arrayContaining(
        contentPublicItemTags(testLocalizedPageContentType, 7),
      ),
    );
    expect(expired).toContain("content:test.localized-page:slug:en:about");
  });

  it("agrees with `contentPublicItemTags`, given or omitted", () => {
    expect(contentPublicItemTags(testLocalizedPageContentType, 7)).toEqual([
      "content:test.localized-page:item:en:7",
    ]);
    expect(
      contentPublicItemTags(testLocalizedPageContentType, 7, "pl"),
    ).toEqual(["content:test.localized-page:item:pl:7"]);
  });

  it("leaves a content type without localization exactly as it was", () => {
    // Passing a locale to something that has none must not invent a segment:
    // every Stage 1-4 tag is byte-identical to what it has always been.
    expect(contentPublicItemTags(testPostContentType, 7, "pl")).toEqual([
      "content:test.post:item:7",
    ]);
  });

  it("sends no locale for a content type without localization", async () => {
    await contentPublicFetch({
      definition: testPostContentType,
      locale: "pl",
      pluginId: "@vitnode/example",
    });

    expect(calls.at(-1)?.query).toBeUndefined();
    expect(calls.at(-1)?.options?.next?.tags).toEqual([LIST_TAG]);
  });
});
