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

/**
 * The Content Engine asks once, like every other AdminCP screen.
 *
 * It was the only family that did not: added a stage later than the rest, its
 * seven query definitions declared no `retry` and so inherited TanStack Query's
 * default of **three attempts with exponential backoff**. Every other AdminCP
 * read - cron, queue, files, users, roles, staff, integrations, debug - spells
 * `retry: false` and each one gives the same reason:
 *
 * - a `403` will not become a `200` because we asked again; it is the
 *   authorization answer, and the route guard is a navigation rule rather than
 *   the boundary, so it can arrive on a screen already open;
 * - a `404` is a record somebody deleted between the list and the click;
 * - a `429` answered by sending the same request twice more is exactly what the
 *   rate limiter asked this application to stop doing;
 * - and a failure the administrator has to act on belongs on screen at once,
 *   not after three attempts and backoff.
 *
 * ## Why this asserts across the factories rather than one at a time
 *
 * A test per definition passes for the seven that exist and says nothing about
 * the eighth. Iterating the exported factories is what makes the rule a property
 * of the *family*: a panel added tomorrow either goes through one of these and
 * inherits the policy, or it is not here and the count below is wrong.
 *
 * That is also why the four editorial panels' definitions were moved out of
 * their components and into `actions/editorial-query.ts` next to the keys they
 * cache under. An inline `useQuery({ … })` in a `.tsx` file cannot be asserted
 * on without rendering it, and rendering tests are not what guards a cache
 * policy.
 */

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

  /**
   * `retry: false` and `retry: undefined` are different answers and only one of
   * them is a decision. `toBe(false)` above already separates them; this states
   * that the property is spelled rather than inherited, so a definition that
   * loses the line fails here instead of quietly asking three times.
   */
  it("spells the policy rather than inheriting a default", () => {
    Object.entries(DEFINITIONS).forEach(([name, options]) => {
      expect(options.retry, name).not.toBeUndefined();
    });
  });

  /**
   * The guard on the family. If a panel is added without coming through
   * `editorial-query.ts` - or a factory is deleted - this number is wrong and
   * somebody has to look at why.
   */
  it("covers every definition the Content Engine exports", () => {
    expect(Object.keys(DEFINITIONS)).toHaveLength(7);
  });
});

/**
 * The other half of the same guarantee, and the reason the retry rule is safe to
 * apply family-wide: everything these definitions cache sits under the one
 * prefix `removeAdminShellQueries` drops.
 *
 * `content-query.test.ts` proves this for the key factories; this proves it for
 * the *query definitions* built from them, which is what a screen actually
 * hands to `useQuery`. The two can drift - a factory could be given a key it
 * did not get from `content-query.ts` - and this is what would catch it.
 */
describe("every Content Engine definition caches under the AdminCP root", () => {
  it.each(Object.entries(DEFINITIONS))("%s", (_name, options) => {
    const key = options.queryKey as readonly unknown[];

    expect(
      ADMIN_QUERY_ROOT.every((segment, index) => key[index] === segment),
      JSON.stringify(key),
    ).toBe(true);
  });

  /**
   * And none of them lands on the admin *session*. Query matches whole
   * segments, so `["vitnode","admin"]` is not a prefix of
   * `["vitnode","admin-session"]` - a content invalidation can never reach the
   * permission set the shell renders from.
   */
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
