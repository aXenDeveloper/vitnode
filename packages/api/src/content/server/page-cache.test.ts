import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventEmitResult } from "@/models/events";
import type { PageCacheStore } from "@/page-cache/store.server";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import {
  configurePageCacheStore,
  createMemoryPageCacheStore,
  latestPageCacheInvalidation,
  resetPageCacheStore,
} from "@/page-cache/store.server";
import {
  testDeliveredLocalizedContentType,
  testDeliveredPostContentType,
  testDuplicableArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type { ContentEventAction } from "../events";

import {
  contentDeliverySitemapTag,
  contentPublicItemTag,
  contentPublicListTag,
} from "../cache";
import { emitContentEvent } from "./emit";
import {
  contentPageInvalidationMode,
  contentSitemapInvalidationMode,
  contentSitemapPageCacheTags,
} from "./page-cache";

const RECORD_TAG = contentPublicItemTag(testPostContentType.id, 7);
const LIST_TAG = contentPublicListTag(testPostContentType.id);

/** A type whose noindex flag sits in a group, `seo.noIndex`. */
const nestedNoIndexType = defineContentType({
  id: "test.nested-noindex",
  tableName: "test_nested_noindex",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    seo: field.group({
      fields: { noIndex: field.boolean({ defaultValue: false }) },
    }),
  },
  publication: true,
  publicApi: {
    path: "nested-noindex",
    fields: ["id", "title", "slug", "seo.noIndex", "publishedAt"],
    defaultOrderBy: "publishedAt",
  },
  delivery: { seo: { noIndexField: "seo.noIndex" }, sitemap: true },
});

describe("contentPageInvalidationMode", () => {
  it.each<
    [ContentEventAction, Record<string, unknown>, "hard" | "soft" | null]
  >([
    ["deleted", {}, "hard"],
    ["hidden", {}, "hard"],
    ["unpublished", {}, "hard"],
    ["translation_unpublished", {}, "hard"],
    ["translation_deleted", {}, "hard"],
    ["delivery_slug_changed", {}, "hard"],
    ["delivery_redirect_created", {}, "hard"],
    ["updated", { changedFields: ["title", "slug"] }, "hard"],
    ["translation_updated", { changedFields: ["slug"] }, "hard"],
    ["updated", { changedFields: ["title"] }, "soft"],
    ["created", {}, "soft"],
    ["published", {}, "soft"],
    ["unhidden", {}, "soft"],
    ["restored", {}, "soft"],
    ["scheduled", {}, null],
    ["schedule_cancelled", {}, null],
  ])("%s %j → %s", (action, payload, mode) => {
    expect(
      contentPageInvalidationMode(testPostContentType, action, payload),
    ).toBe(mode);
  });
});

describe("contentSitemapInvalidationMode", () => {
  it.each<
    [
      string,
      Parameters<typeof contentSitemapInvalidationMode>[0],
      ContentEventAction,
      Record<string, unknown>,
      "hard" | "soft" | null,
    ]
  >([
    [
      "noindex toggled",
      testDeliveredPostContentType,
      "updated",
      { changedFields: ["hidden"] },
      "hard",
    ],
    [
      "noindex toggled through its parent path",
      testDeliveredPostContentType,
      "updated",
      { changedFields: ["data.hidden"] },
      "hard",
    ],
    [
      "another field",
      testDeliveredPostContentType,
      "updated",
      { changedFields: ["title"] },
      "soft",
    ],
    [
      "a field that only starts like it",
      testDeliveredPostContentType,
      "updated",
      { changedFields: ["hiddenAt"] },
      "soft",
    ],
    ["a removal", testDeliveredPostContentType, "deleted", {}, "hard"],
    [
      "no invalidation",
      testDeliveredPostContentType,
      "scheduled",
      { changedFields: ["hidden"] },
      null,
    ],
    [
      "the group holding the flag",
      nestedNoIndexType,
      "updated",
      { changedFields: ["seo"] },
      "hard",
    ],
    [
      "the nested flag",
      nestedNoIndexType,
      "updated",
      { changedFields: ["seo.noIndex"] },
      "hard",
    ],
    [
      "no noIndexField",
      testDeliveredLocalizedContentType,
      "updated",
      { changedFields: ["seo"] },
      "soft",
    ],
  ])("%s → %s", (_, definition, action, payload, mode) => {
    expect(contentSitemapInvalidationMode(definition, action, payload)).toBe(
      mode,
    );
  });
});

describe("contentSitemapPageCacheTags", () => {
  it.each<
    [string, Parameters<typeof contentSitemapPageCacheTags>[0], string[]]
  >([
    [
      "delivery.sitemap",
      testDeliveredPostContentType,
      [contentDeliverySitemapTag(testDeliveredPostContentType.id)],
    ],
    ["delivery without a sitemap", testDuplicableArticleContentType, []],
    ["no delivery", testPostContentType, []],
  ])("%s", (_, definition, tags) => {
    expect(contentSitemapPageCacheTags(definition)).toEqual(tags);
  });
});

describe("emitContentEvent invalidates cached pages", () => {
  const EMITTED: EventEmitResult = {
    delivered: 1,
    eventId: "event-1",
    failures: [],
    status: "delivered",
  };
  let store: PageCacheStore;

  const context = () => {
    const values: Record<string, unknown> = {
      events: { emit: vi.fn().mockResolvedValue(EMITTED) },
      log: { error: vi.fn().mockResolvedValue(undefined) },
    };

    return { get: (key: string) => values[key] } as unknown as Context;
  };

  const stamp = async (tag: string, mode: "hard" | "soft") =>
    await latestPageCacheInvalidation(store, [tag], mode);

  beforeEach(() => {
    store = createMemoryPageCacheStore();
    configurePageCacheStore(store, { maxLifetime: 60 });
  });

  afterEach(() => {
    resetPageCacheStore();
    vi.restoreAllMocks();
  });

  it("hard-invalidates the record and its lists when it is hidden", async () => {
    await expect(
      emitContentEvent(context(), testPostContentType, "hidden", {
        contentId: 7,
      }),
    ).resolves.toEqual(EMITTED);

    expect(await stamp(RECORD_TAG, "hard")).toBeGreaterThan(0);
    expect(await stamp(LIST_TAG, "hard")).toBeGreaterThan(0);
  });

  it("soft-invalidates an ordinary edit", async () => {
    await emitContentEvent(context(), testPostContentType, "updated", {
      changedFields: ["title"],
      contentId: 7,
    });

    expect(await stamp(RECORD_TAG, "soft")).toBeGreaterThan(0);
    expect(await stamp(RECORD_TAG, "hard")).toBe(0);
  });

  it("hard-invalidates the sitemap of an edit that toggles noindex", async () => {
    const recordTag = contentPublicItemTag(testDeliveredPostContentType.id, 7);
    const sitemapTag = contentDeliverySitemapTag(
      testDeliveredPostContentType.id,
    );

    await emitContentEvent(context(), testDeliveredPostContentType, "updated", {
      changedFields: ["hidden"],
      contentId: 7,
    });

    expect(await stamp(sitemapTag, "hard")).toBeGreaterThan(0);
    expect(await stamp(recordTag, "soft")).toBeGreaterThan(0);
    expect(await stamp(recordTag, "hard")).toBe(0);
  });

  it("expires the sitemap with the pages for an ordinary edit", async () => {
    const sitemapTag = contentDeliverySitemapTag(
      testDeliveredPostContentType.id,
    );

    await emitContentEvent(context(), testDeliveredPostContentType, "updated", {
      changedFields: ["title"],
      contentId: 7,
    });

    expect(await stamp(sitemapTag, "soft")).toBeGreaterThan(0);
    expect(await stamp(sitemapTag, "hard")).toBe(0);
  });

  it("reports a store that could not be written with the event's failures", async () => {
    vi.spyOn(store.tags, "set").mockRejectedValue(new Error("redis down"));

    const result = await emitContentEvent(
      context(),
      testPostContentType,
      "deleted",
      { contentId: 7 },
    );

    expect(result).toEqual({
      ...EMITTED,
      failures: [
        {
          error: "redis down",
          listener: "invalidate",
          module: "page-cache",
          pluginId: "@vitnode/core",
        },
      ],
    });
  });
});
