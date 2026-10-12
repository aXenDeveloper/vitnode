import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventEmitResult } from "@/api/models/events";
import type { PageCacheStore } from "@/page-cache/store.server";

import {
  configurePageCacheStore,
  createMemoryPageCacheStore,
  latestPageCacheInvalidation,
  resetPageCacheStore,
} from "@/page-cache/store.server";
import { testPostContentType } from "@/tests/content-fixtures";

import type { ContentEventAction } from "../events";

import { contentPublicItemTag, contentPublicListTag } from "../cache";
import { emitContentEvent } from "./emit";
import { contentPageInvalidationMode } from "./page-cache";

const RECORD_TAG = contentPublicItemTag(testPostContentType.id, 7);
const LIST_TAG = contentPublicListTag(testPostContentType.id);

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
