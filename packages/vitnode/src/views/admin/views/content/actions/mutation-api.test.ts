// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

const revalidated: string[][] = [];
const fetches: { method: string; path?: string }[] = [];
let responses: { data?: unknown; status: number }[] = [];
let definition: AnyContentTypeDefinition = testPostContentType;

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.mock("@/content/next/revalidate.server", async () => {
  // The decision table itself is pure and tested in `content/cache.test.ts`;
  // what matters here is the input the server action hands it.
  const { contentInvalidationTags } = await import("@/content/cache");

  return {
    revalidateContent: (
      input: Parameters<typeof contentInvalidationTags>[0],
    ) => {
      revalidated.push(contentInvalidationTags(input));
    },
  };
});

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
  deleteContentAction,
  editContentAction,
  publishContentAction,
  unpublishContentAction,
} = await import("./mutation-api.server");

const past = new Date(Date.now() - 60_000).toISOString();

const LIST = "content:test.post:list";
const ITEM = "content:test.post:item:7";
const slugTag = (slug: string) => `content:test.post:slug:${slug}`;

beforeEach(() => {
  revalidated.length = 0;
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
    expect(revalidated[0]).toEqual([
      LIST,
      ITEM,
      slugTag("old"),
      slugTag("new"),
    ]);
  });

  it("expires the current slug when it did not move", async () => {
    responses = [
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
      { data: { id: 7, publishedAt: past, slug: "same", status: "published" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(revalidated[0]).toEqual([LIST, ITEM, slugTag("same")]);
  });

  it("touches nothing when the row is a draft before and after", async () => {
    responses = [
      { data: { id: 7, publishedAt: null, slug: "draft", status: "draft" } },
      { data: { id: 7, publishedAt: null, slug: "draft", status: "draft" } },
    ].map(item => ({ ...item, status: 200 }));

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(revalidated[0]).toEqual([]);
  });

  it("does not read anything extra for a content type with no public API", async () => {
    // The pre-write read exists only to learn the old slug, so it is skipped
    // where there are no public tags to expire.
    definition = testCategoryContentType;
    responses = [{ data: { id: 7 }, status: 200 }];

    await editContentAction("test.category", 7, { title: "Hello" });

    expect(fetches.map(item => item.method)).toEqual(["put"]);
    expect(revalidated).toEqual([]);
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

    expect(revalidated[0]).toEqual([LIST, ITEM, slugTag("hello")]);
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

    expect(revalidated[0]).toEqual([LIST, ITEM, slugTag("hello")]);
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

    expect(revalidated).toEqual([]);
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

    expect(revalidated[0]).toEqual([LIST, ITEM, slugTag("hello")]);
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

    expect(revalidated[0]).toEqual([LIST, ITEM, slugTag("hello")]);
  });

  it("expires nothing for a row that never went live", async () => {
    responses = [
      {
        data: { id: 7, publishedAt: null, slug: "hello", status: "draft" },
        status: 200,
      },
    ];

    await deleteContentAction("test.post", 7);

    expect(revalidated[0]).toEqual([]);
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
    expect(revalidated).toEqual([]);
  });
});
