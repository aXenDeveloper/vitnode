// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

interface CacheCall {
  fn: "revalidateTag" | "updateTag";
  tag: string;
}

const cacheCalls: CacheCall[] = [];
const fetches: { method: string; path?: string }[] = [];
let responses: { data?: unknown; status: number }[] = [];
let definition: AnyContentTypeDefinition = testPostContentType;

// The real `revalidate.server` runs: what this suite is about is which Next
// cache function a given mutation ends up calling, so mocking the layer in
// between would test the mock.
vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: (tag: string) => {
    cacheCalls.push({ fn: "revalidateTag", tag });
  },
  updateTag: (tag: string) => {
    cacheCalls.push({ fn: "updateTag", tag });
  },
}));

vi.mock("@/content/admin/config", () => ({
  findFrontendContentType: () => ({
    definition,
    pluginId: "@vitnode/example",
    registration: {},
  }),
}));

vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async ({
    method,
    path,
  }: {
    method: string;
    path?: string;
  }) => {
    await Promise.resolve();
    fetches.push({ method, path });

    return responses.shift() ?? { status: 500 };
  },
}));

const {
  createContentAction,
  deleteContentAction,
  editContentAction,
  publishContentAction,
  unpublishContentAction,
} = await import("./mutation-api.server");

const past = new Date(Date.now() - 60_000).toISOString();

const LIST = "content:test.post:list";
const ITEM = "content:test.post:item:7";
const slugTag = (slug: string) => `content:test.post:slug:${slug}`;

const tags = () => cacheCalls.map(call => call.tag);
/** Which Next cache API was used - `updateTag` is the immediate one. */
const mode = () => [...new Set(cacheCalls.map(call => call.fn))];

beforeEach(() => {
  cacheCalls.length = 0;
  fetches.length = 0;
  responses = [];
  definition = testPostContentType;
});

describe("edit", () => {
  it("reads the row before writing, so a slug change is knowable", async () => {
    responses = [
      { data: { id: 7, publishedAt: past, slug: "old", status: "published" } },
      { data: { id: 7, publishedAt: past, slug: "new", status: "published" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(fetches.map(item => item.method)).toEqual(["get", "put"]);
    expect(tags()).toEqual([LIST, ITEM, slugTag("old"), slugTag("new")]);
  });

  it("expires a moved slug immediately", async () => {
    // The old URL has to stop resolving now. Serving it stale even once would
    // be a 200 for an address the row no longer answers to.
    responses = [
      { data: { id: 7, publishedAt: past, slug: "old", status: "published" } },
      { data: { id: 7, publishedAt: past, slug: "new", status: "published" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(mode()).toEqual(["updateTag"]);
  });

  it("expires the current slug when it did not move", async () => {
    responses = [
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(tags()).toEqual([LIST, ITEM, slugTag("same")]);
  });

  it("lets an ordinary published edit go stale-while-revalidate", async () => {
    // Still published, still the same URL: the response that may be served one
    // more time is one a visitor is allowed to see, so the cache stays warm.
    responses = [
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(mode()).toEqual(["revalidateTag"]);
  });

  it("touches nothing when the row is a draft before and after", async () => {
    responses = [
      { data: { id: 7, publishedAt: null, slug: "draft", status: "draft" } },
      { data: { id: 7, publishedAt: null, slug: "draft", status: "draft" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(cacheCalls).toEqual([]);
  });

  it("does not read anything extra for a content type with no public API", async () => {
    // The pre-write read exists only to learn the old slug, so it is skipped
    // where there are no public tags to expire.
    definition = testCategoryContentType;
    responses = [{ data: { id: 7 }, status: 200 }];

    await editContentAction("test.category", 7, { title: "Hello" });

    expect(fetches.map(item => item.method)).toEqual(["put"]);
    expect(cacheCalls).toEqual([]);
  });
});

describe("publish and unpublish", () => {
  it("expires the list, the item and the slug on publish", async () => {
    responses = [
      {
        data: {
          changed: true,
          row: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        },
        status: 200,
      },
    ];

    await publishContentAction("test.post", 7);

    expect(tags()).toEqual([LIST, ITEM, slugTag("hello")]);
  });

  it("makes a publish visible immediately", async () => {
    // Read-your-own-writes: the post should be there when the success toast is.
    responses = [
      {
        data: {
          changed: true,
          row: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        },
        status: 200,
      },
    ];

    await publishContentAction("test.post", 7);

    expect(mode()).toEqual(["updateTag"]);
  });

  it("expires the same three on unpublish", async () => {
    responses = [
      {
        data: {
          changed: true,
          row: { id: 7, publishedAt: past, slug: "hello", status: "draft" },
        },
        status: 200,
      },
    ];

    await unpublishContentAction("test.post", 7);

    expect(tags()).toEqual([LIST, ITEM, slugTag("hello")]);
  });

  it("takes an unpublished row down immediately", async () => {
    // The one case stale-while-revalidate would get flatly wrong: a visitor
    // reading a post that was just taken off the internet.
    responses = [
      {
        data: {
          changed: true,
          row: { id: 7, publishedAt: past, slug: "hello", status: "draft" },
        },
        status: 200,
      },
    ];

    await unpublishContentAction("test.post", 7);

    expect(mode()).toEqual(["updateTag"]);
  });

  it("expires nothing for a no-op", async () => {
    // Publishing something already published transitioned nothing, so nothing
    // public went stale - a double click must not throw away a warm cache.
    responses = [
      {
        data: {
          changed: false,
          row: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        },
        status: 200,
      },
    ];

    await publishContentAction("test.post", 7);

    expect(cacheCalls).toEqual([]);
  });
});

describe("delete", () => {
  it("expires everything for a row that was published", async () => {
    responses = [
      {
        data: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        status: 200,
      },
    ];

    await deleteContentAction("test.post", 7);

    expect(tags()).toEqual([LIST, ITEM, slugTag("hello")]);
  });

  it("expires a deleted row immediately", async () => {
    // The row is gone. A stale 200 would be a response for something that no
    // longer exists.
    responses = [
      {
        data: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        status: 200,
      },
    ];

    await deleteContentAction("test.post", 7);

    expect(mode()).toEqual(["updateTag"]);
  });

  it("expires everything for a row that was published and then unpublished", async () => {
    // `publishedAt` survives an unpublish, and a delete is final - expiring a
    // URL that is now gone forever costs nothing.
    responses = [
      {
        data: { id: 7, publishedAt: past, slug: "hello", status: "draft" },
        status: 200,
      },
    ];

    await deleteContentAction("test.post", 7);

    expect(tags()).toEqual([LIST, ITEM, slugTag("hello")]);
  });

  it("expires nothing for a row that never went live", async () => {
    responses = [
      {
        data: { id: 7, publishedAt: null, slug: "hello", status: "draft" },
        status: 200,
      },
    ];

    await deleteContentAction("test.post", 7);

    expect(cacheCalls).toEqual([]);
  });
});

describe("create", () => {
  it("expires nothing, because a new row is a draft", async () => {
    responses = [
      {
        data: { id: 7, publishedAt: null, slug: "hello", status: "draft" },
        status: 201,
      },
    ];

    await createContentAction("test.post", { title: "Hello" });

    expect(cacheCalls).toEqual([]);
  });
});

describe("failures", () => {
  it("expires nothing when the write failed", async () => {
    responses = [
      {
        data: { id: 7, publishedAt: past, slug: "hello", status: "published" },
        status: 200,
      },
      { status: 409 },
    ];

    const result = await editContentAction("test.post", 7, { slug: "taken" });

    expect(result.status).toBe(409);
    expect(cacheCalls).toEqual([]);
  });
});
