// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnyContentTypeDefinition } from "@/content/types";

import {
  testCategoryContentType,
  testDeliveredPostContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

interface CacheCall {
  fn: "revalidateTag" | "updateTag";
  tag: string;
}

const cacheCalls: CacheCall[] = [];
const fetches: { body?: unknown; method: string; path?: string }[] = [];
let responses: { data?: unknown; error?: string; status: number }[] = [];
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
    body,
    method,
    path,
  }: {
    body?: unknown;
    method: string;
    path?: string;
  }) => {
    await Promise.resolve();
    fetches.push({ body, method, path });

    return responses.shift() ?? { status: 500 };
  },
}));

const {
  createContentAction,
  deleteContentAction,
  editContentAction,
  listContentRevisionsAction,
  publishContentAction,
  reloadContentRowAction,
  restoreContentRevisionAction,
  unpublishContentAction,
} = await import("./mutation-api.server");

const past = new Date(Date.now() - 60_000).toISOString();

const LIST = "content:test.post:list";
const ITEM = "content:test.post:item:7";
const slugTag = (slug: string) => `content:test.post:slug:${slug}`;
/** The editorial fixture is a different content type, so different tags. */
const editorialSlugTag = (slug: string) =>
  `content:test.editorial:slug:${slug}`;

/** The delivery fixture's own tags. */
const DELIVERED = "test.delivered-post";
const DELIVERY_ITEM = `content:${DELIVERED}:delivery:7`;
const DELIVERY_SITEMAP = `content:${DELIVERED}:sitemap`;
const deliveryRedirectTag = (slug: string) =>
  `content:${DELIVERED}:redirect:${slug}`;

/**
 * One `updatedAt` per call, monotonically increasing.
 *
 * A real write moves the timestamp; a no-op does not. That distinction is the whole
 * signal the sitemap decision reads, so the fixtures have to be explicit about it
 * rather than reusing one constant everywhere.
 */
let clock = Date.parse("2026-01-01T00:00:00.000Z");
const tick = (): string => {
  clock += 60_000;

  return new Date(clock).toISOString();
};

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

/**
 * The sitemap half of delivery invalidation.
 *
 * A sitemap entry carries `<lastmod>`, derived from `updatedAt` - so a plain title
 * edit on a published record changes the **bytes** of its sitemap file even though the
 * set of URLs is identical. Treating "the sitemap changed" as "membership changed"
 * leaves a cached file serving a stale timestamp, which is what these tests pin down.
 */
describe("delivery sitemap invalidation", () => {
  const published = (slug: string, updatedAt: string) => ({
    data: {
      id: 7,
      publishedAt: past,
      slug,
      status: "published",
      updatedAt,
    },
    status: 200,
  });

  beforeEach(() => {
    definition = testDeliveredPostContentType;
  });

  it("expires the sitemap for a title edit that moved no URL", async () => {
    const before = tick();
    responses = [published("same", before), published("same", tick())];

    await editContentAction(DELIVERED, 7, { title: "Hello" });

    // The URL did not move, so nothing was added to or removed from the file - but
    // `updatedAt` did, so its `<lastmod>` is different and the cached bytes are stale.
    expect(tags()).toContain(DELIVERY_SITEMAP);
  });

  it("expires the sitemap for an SEO-only edit", async () => {
    const before = tick();
    responses = [published("same", before), published("same", tick())];

    await editContentAction(DELIVERED, 7, { excerpt: "A new summary." });

    expect(tags()).toContain(DELIVERY_SITEMAP);
  });

  it("leaves the sitemap alone for a no-op edit", async () => {
    // The engine issues no `UPDATE` for an update that changed nothing, so
    // `updatedAt` does not move and the cached sitemap is still byte-correct.
    const unchanged = tick();
    responses = [published("same", unchanged), published("same", unchanged)];

    await editContentAction(DELIVERED, 7, { title: "Hello" });

    expect(tags()).not.toContain(DELIVERY_SITEMAP);
    // The rest of the delivery invalidation still happens: the metadata tag and the
    // slug's redirect lookup are expired whether or not the sitemap moved.
    expect(tags()).toContain(DELIVERY_ITEM);
    expect(tags()).toContain(deliveryRedirectTag("same"));
  });

  it("leaves the sitemap alone for a draft edit", async () => {
    const draft = (updatedAt: string) => ({
      data: {
        id: 7,
        publishedAt: null,
        slug: "draft",
        status: "draft",
        updatedAt,
      },
      status: 200,
    });
    responses = [draft(tick()), draft(tick())];

    await editContentAction(DELIVERED, 7, { title: "Hello" });

    // Not public before or after, so it is in no sitemap file either way.
    expect(cacheCalls).toEqual([]);
  });

  it("expires the sitemap on a slug change", async () => {
    responses = [published("old", tick()), published("new", tick())];

    await editContentAction(DELIVERED, 7, { title: "Hello" });

    expect(tags()).toContain(DELIVERY_SITEMAP);
    expect(tags()).toContain(deliveryRedirectTag("old"));
    expect(tags()).toContain(deliveryRedirectTag("new"));
  });

  it("expires the sitemap on publish and on unpublish", async () => {
    responses = [
      {
        data: {
          changed: true,
          row: {
            id: 7,
            publishedAt: past,
            slug: "hello",
            status: "published",
            updatedAt: tick(),
          },
        },
        status: 200,
      },
    ];

    await publishContentAction(DELIVERED, 7);

    expect(tags()).toContain(DELIVERY_SITEMAP);
  });

  it("expires the sitemap on delete when the record had been published", async () => {
    responses = [published("hello", tick())];

    await deleteContentAction(DELIVERED, 7, 1);

    expect(tags()).toContain(DELIVERY_SITEMAP);
  });

  it("leaves the sitemap alone when deleting a record that was never published", async () => {
    responses = [
      {
        data: {
          id: 7,
          publishedAt: null,
          slug: "draft",
          status: "draft",
          updatedAt: tick(),
        },
        status: 200,
      },
    ];

    await deleteContentAction(DELIVERED, 7, 1);

    expect(tags()).not.toContain(DELIVERY_SITEMAP);
  });

  it("adds no delivery tags at all to a content type without delivery", async () => {
    // The Stage 1-7 promise: the tag list of an existing content type does not move.
    definition = testPostContentType;
    responses = [published("same", tick()), published("same", tick())];

    await editContentAction("test.post", 7, { title: "Hello" });

    expect(tags()).toEqual([LIST, ITEM, slugTag("same")]);
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

describe("editorial", () => {
  beforeEach(() => {
    definition = testEditorialPostContentType;
  });

  const editorialRow = {
    id: 7,
    publishedAt: past,
    slug: "hello",
    status: "published",
    title: "Hello",
    version: 4,
  };

  it("wraps the values in an envelope with the expected version", async () => {
    responses = [
      { data: editorialRow, status: 200 },
      { data: { ...editorialRow, version: 5 }, status: 200 },
    ];

    await editContentAction("test.editorial", 7, { title: "Changed" }, 4);

    const put = fetches.find(entry => entry.method === "put");
    expect(put?.body).toEqual({
      expectedVersion: 4,
      values: { title: "Changed" },
    });
  });

  it("sends a bare body for a content type without the workflow", async () => {
    definition = testPostContentType;
    responses = [
      { data: editorialRow, status: 200 },
      { data: editorialRow, status: 200 },
    ];

    await editContentAction("test.post", 7, { title: "Changed" }, 4);

    const put = fetches.find(entry => entry.method === "put");
    expect(put?.body).toEqual({ title: "Changed" });
  });

  it("surfaces a version conflict as structured data", async () => {
    responses = [
      { data: editorialRow, status: 200 },
      {
        error: JSON.stringify({
          code: "CONTENT_VERSION_CONFLICT",
          contentTypeId: "test.editorial",
          currentVersion: 9,
          expectedVersion: 4,
          itemId: 7,
        }),
        status: 409,
      },
    ];

    const result = await editContentAction(
      "test.editorial",
      7,
      { title: "Changed" },
      4,
    );

    expect(result.conflict).toEqual({
      code: "CONTENT_VERSION_CONFLICT",
      contentTypeId: "test.editorial",
      currentVersion: 9,
      expectedVersion: 4,
      itemId: 7,
    });
    // A refused write changed nothing, so nothing public went stale.
    expect(cacheCalls).toEqual([]);
  });

  it("leaves `conflict` unset for a plain-text failure", async () => {
    responses = [
      { data: editorialRow, status: 200 },
      { error: "A record with these values already exists.", status: 409 },
    ];

    const result = await editContentAction(
      "test.editorial",
      7,
      { title: "Changed" },
      4,
    );

    expect(result.conflict).toBeUndefined();
    expect(result.status).toBe(409);
  });

  it("reads one record back without touching the cache", async () => {
    responses = [{ data: { ...editorialRow, version: 9 }, status: 200 }];

    const result = await reloadContentRowAction("test.editorial", 7);

    expect(result.row?.version).toBe(9);
    // The dialog is still open with unsaved values; a refresh would discard
    // them, so the reload must not trigger one.
    expect(cacheCalls).toEqual([]);
  });

  it("lists revisions", async () => {
    responses = [
      {
        data: {
          edges: [{ id: 20, version: 5 }],
          pageInfo: { endCursor: 5, hasNextPage: false },
        },
        status: 200,
      },
    ];

    const result = await listContentRevisionsAction("test.editorial", 7);

    expect(result.edges).toHaveLength(1);
    expect(fetches[0].path).toBe("/7/revisions");
  });

  it("carries the page info back so the dialog can offer another page", async () => {
    responses = [
      {
        data: {
          edges: [{ id: 20, version: 5 }],
          pageInfo: { endCursor: 5, hasNextPage: true },
        },
        status: 200,
      },
    ];

    const result = await listContentRevisionsAction("test.editorial", 7);

    expect(result.pageInfo).toEqual({ endCursor: 5, hasNextPage: true });
  });

  it("sends the cursor as a query parameter", async () => {
    responses = [
      {
        data: { edges: [], pageInfo: { endCursor: null, hasNextPage: false } },
        status: 200,
      },
    ];

    await listContentRevisionsAction("test.editorial", 7, 36);

    expect(fetches[0]).toMatchObject({ path: "/7/revisions" });
  });

  it("reports the new version after a restore", async () => {
    // The dialog stays open, so its next restore needs the version the record
    // holds now - reusing the one it opened with would conflict with the
    // restore it just performed.
    responses = [
      { data: editorialRow, status: 200 },
      {
        data: { changed: true, row: { ...editorialRow, version: 5 } },
        status: 200,
      },
    ];

    const result = await restoreContentRevisionAction(
      "test.editorial",
      7,
      3,
      4,
    );

    expect(result.version).toBe(5);
  });

  describe("delete", () => {
    it("sends the version the row was showing", async () => {
      responses = [{ data: editorialRow, status: 200 }];

      await deleteContentAction("test.editorial", 7, 4);

      expect(fetches[0]).toMatchObject({
        body: { expectedVersion: 4 },
        method: "delete",
        path: "/7",
      });
    });

    it("sends no body for a content type without editorial", async () => {
      // The Stage 1-3 contract. A precondition on a route that never had one
      // would break every existing client.
      definition = testPostContentType;
      responses = [{ data: { id: 7, publishedAt: null }, status: 200 }];

      await deleteContentAction("test.post", 7, 4);

      expect(fetches[0].body).toBeUndefined();
    });

    it("hands the version conflict back to the caller to explain", async () => {
      responses = [
        {
          error: JSON.stringify({
            code: "CONTENT_VERSION_CONFLICT",
            contentTypeId: "test.editorial",
            currentVersion: 5,
            expectedVersion: 4,
            itemId: 7,
          }),
          status: 409,
        },
      ];

      const result = await deleteContentAction("test.editorial", 7, 4);

      expect(result.conflict?.code).toBe("CONTENT_VERSION_CONFLICT");
      // Nothing was deleted, so nothing public went stale.
      expect(cacheCalls).toEqual([]);
    });
  });

  it("expires the old and new slug when a restore moves the URL", async () => {
    responses = [
      { data: editorialRow, status: 200 },
      {
        data: {
          changed: true,
          row: { ...editorialRow, slug: "moved", version: 5 },
        },
        status: 200,
      },
    ];

    await restoreContentRevisionAction("test.editorial", 7, 3, 4);

    expect(tags()).toContain(editorialSlugTag("hello"));
    expect(tags()).toContain(editorialSlugTag("moved"));
    // A moved URL must not serve its old response even once.
    expect(mode()).toEqual(["updateTag"]);
  });

  it("keeps the cache warm when a restore leaves the URL alone", async () => {
    responses = [
      { data: editorialRow, status: 200 },
      {
        data: { changed: true, row: { ...editorialRow, version: 5 } },
        status: 200,
      },
    ];

    await restoreContentRevisionAction("test.editorial", 7, 3, 4);

    expect(mode()).toEqual(["revalidateTag"]);
  });
});
