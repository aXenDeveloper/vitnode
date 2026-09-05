// @vitest-environment node
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  contentDeliveryQueryKey,
  contentHistoryQueryKey,
  contentItemQueryKey,
  contentListQueryKey,
  contentOptionsQueryKey,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
} from "../content-query";
import {
  invalidateContentDelivery,
  invalidateContentHistory,
  invalidateContentItem,
  invalidateContentList,
  invalidateContentSchedules,
  invalidateContentTranslations,
  removeContentItem,
  removeContentOptions,
} from "./invalidate";

const TYPE = "blog.post";
const OTHER_TYPE = "blog.category";
const ITEM = 42;
const OTHER_ITEM = 43;

/** Every key a record's screens fill, so a write can be checked against all of them. */
const keysFor = (type: string, item: number) => ({
  delivery: contentDeliveryQueryKey(type, item),
  history: contentHistoryQueryKey(type, item, { kind: "list" }),
  item: contentItemQueryKey(type, item),
  list: contentListQueryKey(type, { first: 25 }),
  options: contentOptionsQueryKey(type, "category", "en"),
  schedules: contentSchedulesQueryKey(type, item),
  translations: contentTranslationsQueryKey(type, item),
});

const seed = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });

  for (const type of [TYPE, OTHER_TYPE]) {
    for (const item of [ITEM, OTHER_ITEM]) {
      for (const key of Object.values(keysFor(type, item))) {
        queryClient.setQueryData(key, { seeded: true });
      }
    }
  }

  return queryClient;
};

const isStale = (queryClient: QueryClient, key: readonly unknown[]): boolean =>
  queryClient.getQueryState(key)?.isInvalidated === true;

const isGone = (queryClient: QueryClient, key: readonly unknown[]): boolean =>
  queryClient.getQueryData(key) === undefined;

describe("a delete drops the record from the cache", () => {
  it("removes the record and every fact hanging off it", async () => {
    const queryClient = seed();

    removeContentItem(queryClient, TYPE, ITEM);
    await invalidateContentList(queryClient, TYPE);

    const keys = keysFor(TYPE, ITEM);

    expect(isGone(queryClient, keys.item)).toBe(true);
    expect(isGone(queryClient, keys.translations)).toBe(true);
    expect(isGone(queryClient, keys.history)).toBe(true);
    expect(isGone(queryClient, keys.schedules)).toBe(true);
    expect(isGone(queryClient, keys.delivery)).toBe(true);
  });

  it("removes rather than merely marking stale", () => {
    // The distinction the bug lives in: a stale entry is still served, so a
    // history dialog reopened from a stale row would draw a deleted record's
    // timeline.
    const queryClient = seed();

    removeContentItem(queryClient, TYPE, ITEM);

    expect(isGone(queryClient, keysFor(TYPE, ITEM).history)).toBe(true);
  });

  it("refreshes the list rather than emptying it", async () => {
    // Invalidating keeps the current rows on screen while the fresh ones
    // arrive, instead of blanking the table under the dialog still closing.
    const queryClient = seed();
    const keys = keysFor(TYPE, ITEM);

    await invalidateContentList(queryClient, TYPE);

    expect(isGone(queryClient, keys.list)).toBe(false);
    expect(isStale(queryClient, keys.list)).toBe(true);
  });

  it("leaves a sibling record alone", () => {
    const queryClient = seed();

    removeContentItem(queryClient, TYPE, ITEM);

    for (const key of Object.values(keysFor(TYPE, OTHER_ITEM))) {
      expect(isGone(queryClient, key)).toBe(false);
    }
  });

  it("leaves another content type alone", () => {
    const queryClient = seed();

    removeContentItem(queryClient, TYPE, ITEM);
    removeContentOptions(queryClient, TYPE);

    for (const key of Object.values(keysFor(OTHER_TYPE, ITEM))) {
      expect(isGone(queryClient, key)).toBe(false);
    }
  });

  it("drops every picker offering the deleted type, so it is not still on offer", () => {
    const queryClient = seed();

    removeContentOptions(queryClient, TYPE);

    expect(isGone(queryClient, keysFor(TYPE, ITEM).options)).toBe(true);
    expect(isGone(queryClient, keysFor(OTHER_TYPE, ITEM).options)).toBe(false);
  });
});

describe("a record write reaches everything under the record", () => {
  it("marks the record, its translations, its history and its delivery stale", async () => {
    const queryClient = seed();

    await invalidateContentItem(queryClient, TYPE, ITEM);

    const keys = keysFor(TYPE, ITEM);

    expect(isStale(queryClient, keys.item)).toBe(true);
    expect(isStale(queryClient, keys.translations)).toBe(true);
    expect(isStale(queryClient, keys.history)).toBe(true);
    expect(isStale(queryClient, keys.schedules)).toBe(true);
    expect(isStale(queryClient, keys.delivery)).toBe(true);
  });

  it("does not reach the list", async () => {
    // The list is invalidated separately and deliberately: not every record
    // write changes a column the table renders.
    const queryClient = seed();

    await invalidateContentItem(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, keysFor(TYPE, ITEM).list)).toBe(false);
  });

  it("does not reach a sibling record", async () => {
    const queryClient = seed();

    await invalidateContentItem(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, keysFor(TYPE, OTHER_ITEM).item)).toBe(false);
  });
});

describe("the narrow helpers stay narrow", () => {
  it("a restore expires the timeline and nothing else", async () => {
    const queryClient = seed();
    const keys = keysFor(TYPE, ITEM);

    await invalidateContentHistory(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, keys.history)).toBe(true);
    expect(isStale(queryClient, keys.item)).toBe(false);
    expect(isStale(queryClient, keys.schedules)).toBe(false);
    expect(isStale(queryClient, keys.list)).toBe(false);
  });

  it("a schedule expires the schedule list and nothing else", async () => {
    const queryClient = seed();
    const keys = keysFor(TYPE, ITEM);

    await invalidateContentSchedules(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, keys.schedules)).toBe(true);
    expect(isStale(queryClient, keys.item)).toBe(false);
    expect(isStale(queryClient, keys.history)).toBe(false);
    expect(isStale(queryClient, keys.list)).toBe(false);
  });

  it("a translation write expires the languages and nothing else", async () => {
    const queryClient = seed();
    const keys = keysFor(TYPE, ITEM);

    await invalidateContentTranslations(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, keys.translations)).toBe(true);
    expect(isStale(queryClient, keys.item)).toBe(false);
    expect(isStale(queryClient, keys.history)).toBe(false);
  });

  it("a delivery read expires every language of one record", async () => {
    const queryClient = seed();
    const localized = [...contentDeliveryQueryKey(TYPE, ITEM), "pl"] as const;

    queryClient.setQueryData(localized, { seeded: true });
    await invalidateContentDelivery(queryClient, TYPE, ITEM);

    expect(isStale(queryClient, localized)).toBe(true);
    expect(isStale(queryClient, keysFor(TYPE, ITEM).delivery)).toBe(true);
    expect(isStale(queryClient, keysFor(TYPE, ITEM).item)).toBe(false);
  });

  it("never reaches another content type, whichever helper is called", async () => {
    const queryClient = seed();

    await invalidateContentList(queryClient, TYPE);
    await invalidateContentItem(queryClient, TYPE, ITEM);
    await invalidateContentHistory(queryClient, TYPE, ITEM);
    await invalidateContentSchedules(queryClient, TYPE, ITEM);
    await invalidateContentTranslations(queryClient, TYPE, ITEM);
    await invalidateContentDelivery(queryClient, TYPE, ITEM);

    for (const key of Object.values(keysFor(OTHER_TYPE, ITEM))) {
      expect(isStale(queryClient, key)).toBe(false);
    }
  });
});
