// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";

import {
  contentDeliveryQueryOptions,
  contentRevisionHistoryQueryOptions,
  contentRevisionQueryOptions,
  contentSchedulesQueryOptions,
} from "./actions/editorial-query";
import {
  contentItemQueryOptions,
  contentTranslationsQueryOptions,
} from "./form/item-query";
import { contentListQueryOptions } from "./table/list-query";

const TYPE = "blog.post";
const ITEM = 42;

/** A fetcher that is never called - these tests build options, never run them. */
const never = () => {
  throw new Error("a query definition test must not fetch");
};

/**
 * Every query definition the Content Engine exports, built with a request that
 * is representative rather than special.
 */
const DEFINITIONS = {
  delivery: contentDeliveryQueryOptions({
    contentTypeId: TYPE,
    itemId: ITEM,
    locale: "en",
    readDelivery: never,
  }),
  item: contentItemQueryOptions({
    fetchItem: never,
    request: {
      contentTypeId: TYPE,
      itemId: ITEM,
      target: { permissionModule: "post", pluginId: "@vitnode/blog" },
    },
  }),
  list: contentListQueryOptions({
    fetchPage: never,
    request: {
      contentTypeId: TYPE,
      query: { first: "25" },
      target: { permissionModule: "post", pluginId: "@vitnode/blog" },
    },
  }),
  revision: contentRevisionQueryOptions({
    contentTypeId: TYPE,
    getRevision: never,
    itemId: ITEM,
    revisionId: 7,
  }),
  revisionHistory: contentRevisionHistoryQueryOptions({
    contentTypeId: TYPE,
    itemId: ITEM,
    listRevisions: never,
  }),
  schedules: contentSchedulesQueryOptions({
    contentTypeId: TYPE,
    itemId: ITEM,
    listSchedules: never,
  }),
  translations: contentTranslationsQueryOptions({
    fetchTranslations: never,
    request: {
      contentTypeId: TYPE,
      itemId: ITEM,
      target: { permissionModule: "post", pluginId: "@vitnode/blog" },
    },
  }),
} as const;

describe("no Content Engine read retries", () => {
  it.each(Object.entries(DEFINITIONS))("%s", (_name, options) => {
    expect(options.retry).toBe(false);
  });

  it("spells the policy rather than inheriting a default", () => {
    Object.entries(DEFINITIONS).forEach(([name, options]) => {
      expect(options.retry, name).not.toBeUndefined();
    });
  });

  it("covers every definition the Content Engine exports", () => {
    expect(Object.keys(DEFINITIONS)).toHaveLength(7);
  });
});

describe("every Content Engine definition caches under the AdminCP root", () => {
  it.each(Object.entries(DEFINITIONS))("%s", (_name, options) => {
    const key = options.queryKey as readonly unknown[];

    expect(
      ADMIN_QUERY_ROOT.every((segment, index) => key[index] === segment),
      JSON.stringify(key),
    ).toBe(true);
  });

  it("never reaches the admin session entry", () => {
    Object.entries(DEFINITIONS).forEach(([name, options]) => {
      expect((options.queryKey as readonly unknown[])[1], name).toBe("admin");
    });
  });

  /** No two definitions share an entry. */
  it("gives each definition a key of its own", () => {
    const keys = Object.values(DEFINITIONS).map(options =>
      JSON.stringify(options.queryKey),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
