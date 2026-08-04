// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testPostContentType } from "@/tests/content-fixtures";

interface FetchArgs {
  module: string;
  options?: { cache?: string; next?: { tags?: string[] } };
  path: string;
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

const { contentPublicFetch } = await import("./fetch.server");

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
