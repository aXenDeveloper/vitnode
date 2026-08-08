// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testEditorialPostContentType,
  testLocalizedPageContentType,
} from "@/tests/content-fixtures";

/**
 * Which responses are allowed into a shared cache, and under which key.
 *
 * Three questions, and getting any of them wrong is a data leak rather than a
 * performance problem:
 *
 * 1. **Is anything private cached at all?** A preview is an unpublished record
 *    behind a short-lived credential, and an AdminCP read is a staff response
 *    carrying private columns. Neither may be stored.
 * 2. **Can a private response land on a public key?** Only tagged, cached
 *    responses can, so this reduces to (1) - but it is asserted from the tag
 *    side as well, because "no tags" is what makes it true.
 * 3. **Do two spellings of one locale share a key?** `PL`, `pl` and ` pl `
 *    address the same page, so they have to expire together. A tag is a string
 *    comparison, so the normalisation has to happen when the tag is built.
 */

interface FetchArgs {
  module: string;
  options?: { cache?: string; next?: { tags?: string[] } };
  path: string;
  prefixPath?: string;
  query?: Record<string, string | string[] | undefined>;
}

const calls = vi.hoisted(() => [] as FetchArgs[]);

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => await Promise.resolve({ toString: () => "session=x" }),
  headers: async () => await Promise.resolve(new Headers()),
}));

vi.mock("../../lib/fetcher/raw", () => ({
  rawApiFetch: async (args: FetchArgs) => {
    calls.push(args);

    return await Promise.resolve(
      new Response(JSON.stringify({ id: 7, title: "Hello" }), { status: 200 }),
    );
  },
}));

const { contentPublicItemTag, contentPublicListTag, contentPublicSlugTag } =
  await import("../cache");
const { contentPreviewFetch, contentPublicFetch } =
  await import("./fetch.server");
const { contentApiFetch } = await import("../admin/fetch.server");

const PLUGIN_ID = "@vitnode/example";

const lastCall = (): FetchArgs => {
  const call = calls.at(-1);
  if (!call) throw new Error("Expected a request.");

  return call;
};

beforeEach(() => {
  calls.length = 0;
});

describe("a private response is never cached and never tagged", () => {
  it("reads a preview with no store and no tags", async () => {
    await contentPreviewFetch({
      definition: testEditorialPostContentType,
      pluginId: PLUGIN_ID,
      token: "signed-token",
    });

    const call = lastCall();
    expect(call.options?.cache).toBe("no-store");
    expect(call.options?.next?.tags).toBeUndefined();
  });

  it("reads a localized preview the same way", async () => {
    await contentPreviewFetch({
      definition: testLocalizedPageContentType,
      locale: "pl",
      pluginId: PLUGIN_ID,
      token: "signed-token",
    });

    const call = lastCall();
    expect(call.options?.cache).toBe("no-store");
    expect(call.options?.next?.tags).toBeUndefined();
  });

  it("reads the AdminCP API with no cache options at all", async () => {
    // An admin response carries every private column the content type has. It
    // is also per-session: it forwards the staff cookie, so a cached one would
    // be one editor's view served to the next.
    await contentApiFetch({
      definition: testEditorialPostContentType,
      method: "get",
      path: "/7",
      pluginId: PLUGIN_ID,
    });

    const call = lastCall();
    expect(call.options).toBeUndefined();
    expect(call.prefixPath).toBe("/admin");
  });

  it("keeps the admin module out of the public tag namespace", async () => {
    // Belt and braces: even if an admin read were cached one day, it addresses
    // `content/{permissionModule}` under `/admin`, and the public tags are
    // built from `publicApi.path`. The two cannot be confused for each other.
    await contentApiFetch({
      definition: testEditorialPostContentType,
      method: "get",
      pluginId: PLUGIN_ID,
    });
    const adminCall = lastCall();

    await contentPublicFetch({
      definition: testEditorialPostContentType,
      pluginId: PLUGIN_ID,
    });
    const publicCall = lastCall();

    expect(adminCall.module).not.toBe(publicCall.module);
    expect(publicCall.options?.next?.tags).toContain(
      contentPublicListTag(testEditorialPostContentType.id),
    );
  });
});

describe("a public response is cached under exactly one key per locale", () => {
  it.each([["pl"], ["PL"], [" pl "], ["pL"]])(
    "normalises %s onto the same tags",
    locale => {
      const id = testLocalizedPageContentType.id;

      expect(contentPublicListTag(id, locale)).toBe(
        contentPublicListTag(id, "pl"),
      );
      expect(contentPublicItemTag(id, 7, locale)).toBe(
        contentPublicItemTag(id, 7, "pl"),
      );
      expect(contentPublicSlugTag(id, "witaj", locale)).toBe(
        contentPublicSlugTag(id, "witaj", "pl"),
      );
    },
  );

  it("sends the same tags however the caller spelled the locale", async () => {
    const tagsFor = async (locale: string) => {
      await contentPublicFetch({
        definition: testLocalizedPageContentType,
        locale,
        pluginId: PLUGIN_ID,
        slug: "witaj",
      });

      return lastCall().options?.next?.tags;
    };

    expect(await tagsFor("PL")).toEqual(await tagsFor("pl"));
  });

  it("keeps two languages on one slug apart", () => {
    // The whole reason the locale is in the slug tag: `/en/about` and
    // `/pl/about` are two pages, and expiring one must not expire the other.
    const id = testLocalizedPageContentType.id;

    expect(contentPublicSlugTag(id, "about", "en")).not.toBe(
      contentPublicSlugTag(id, "about", "pl"),
    );
  });

  it("keeps a localized tag out of the locale-less namespace", () => {
    // A localized content type has no locale-less public URL, so a tag without
    // a locale segment would name a page that does not exist - and one that a
    // non-localized content type might legitimately own.
    const id = testLocalizedPageContentType.id;

    expect(contentPublicListTag(id, "en")).not.toBe(contentPublicListTag(id));
  });
});
