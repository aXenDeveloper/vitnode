// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentRevisionMeta } from "@/content/revisions";

import {
  contentDeliveryQueryKey,
  contentHistoryQueryRoot,
  contentItemQueryRoot,
  contentListQueryRoot,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
} from "../content-query";
import {
  contentDeliveryLocaleQueryKey,
  contentHistoryListQueryKey,
  contentRevisionQueryKey,
  flattenContentRevisionPages,
  nextContentRevisionCursor,
} from "./editorial-query";

/**
 * The editorial panels' cache keys and the pure arithmetic around them.
 *
 * Prefixes, again, because that is the only property React Query uses: a delete
 * removes `contentItemQueryRoot`, and every one of these has to sit under it or
 * a deleted record's history survives in memory and can be rendered.
 */

const isPrefixOf = (
  prefix: readonly unknown[],
  key: readonly unknown[],
): boolean =>
  prefix.length <= key.length &&
  prefix.every((segment, index) => Object.is(segment, key[index]));

const TYPE = "blog.post";
const ITEM = 42;

const revision = (id: number, version: number): ContentRevisionMeta =>
  ({ id, version }) as ContentRevisionMeta;

const page = (
  ids: number[],
  pageInfo: { endCursor: null | number; hasNextPage: boolean },
) => ({ edges: ids.map(id => revision(id, id)), pageInfo });

describe("history keys", () => {
  it("hangs the timeline off the record's history root", () => {
    expect(
      isPrefixOf(
        contentHistoryQueryRoot(TYPE, ITEM),
        contentHistoryListQueryKey(TYPE, ITEM),
      ),
    ).toBe(true);
  });

  it("hangs one revision off the same root, so a restore expires both", () => {
    expect(
      isPrefixOf(
        contentHistoryQueryRoot(TYPE, ITEM),
        contentRevisionQueryKey(TYPE, ITEM, 7),
      ),
    ).toBe(true);
  });

  it("keeps the timeline and a revision apart", () => {
    expect(contentHistoryListQueryKey(TYPE, ITEM)).not.toEqual(
      contentRevisionQueryKey(TYPE, ITEM, 7),
    );
  });

  it("keeps two revisions of one record apart", () => {
    expect(contentRevisionQueryKey(TYPE, ITEM, 7)).not.toEqual(
      contentRevisionQueryKey(TYPE, ITEM, 8),
    );
  });

  it("does not reach a sibling record's history", () => {
    expect(
      isPrefixOf(
        contentHistoryQueryRoot(TYPE, ITEM),
        contentHistoryListQueryKey(TYPE, ITEM + 1),
      ),
    ).toBe(false);
  });

  it("is dropped with the record it belongs to", () => {
    // The delete guarantee: `removeContentItem` drops the item root, so nothing
    // below it can be read back afterwards.
    for (const key of [
      contentHistoryListQueryKey(TYPE, ITEM),
      contentRevisionQueryKey(TYPE, ITEM, 7),
    ]) {
      expect(isPrefixOf(contentItemQueryRoot(TYPE, ITEM), key)).toBe(true);
    }
  });

  it("is not reached by invalidating the list", () => {
    // A publish invalidates the list. It must not throw away a history panel
    // that is open beside it and has not changed.
    expect(
      isPrefixOf(
        contentListQueryRoot(TYPE),
        contentHistoryListQueryKey(TYPE, ITEM),
      ),
    ).toBe(false);
  });
});

describe("translation keys", () => {
  it("hangs every language of a record off that record", () => {
    expect(
      isPrefixOf(
        contentItemQueryRoot(TYPE, ITEM),
        contentTranslationsQueryKey(TYPE, ITEM),
      ),
    ).toBe(true);
  });

  it("does not reach a sibling record's translations", () => {
    expect(contentTranslationsQueryKey(TYPE, ITEM)).not.toEqual(
      contentTranslationsQueryKey(TYPE, ITEM + 1),
    );
  });

  it("is a different entry from the record itself", () => {
    // They go stale separately: a save that touched only the Polish copy leaves
    // the base row exactly as it was.
    expect(contentTranslationsQueryKey(TYPE, ITEM)).not.toEqual(
      contentItemQueryRoot(TYPE, ITEM),
    );
  });

  it("does not collide with the record's history or schedules", () => {
    const translations = contentTranslationsQueryKey(TYPE, ITEM);

    expect(isPrefixOf(contentHistoryQueryRoot(TYPE, ITEM), translations)).toBe(
      false,
    );
    expect(isPrefixOf(contentSchedulesQueryKey(TYPE, ITEM), translations)).toBe(
      false,
    );
  });
});

describe("delivery keys", () => {
  it("keeps one language's addresses apart from another's", () => {
    expect(contentDeliveryLocaleQueryKey(TYPE, ITEM, "en")).not.toEqual(
      contentDeliveryLocaleQueryKey(TYPE, ITEM, "pl"),
    );
  });

  it("stands a content type with no translations on one entry", () => {
    // `undefined` is "this record has exactly one address", and it has to be a
    // stable segment rather than a hole - two calls must agree.
    expect(contentDeliveryLocaleQueryKey(TYPE, ITEM, undefined)).toEqual(
      contentDeliveryLocaleQueryKey(TYPE, ITEM, undefined),
    );
  });

  it("expires every language of one record from the delivery root", () => {
    for (const locale of ["en", "pl", undefined]) {
      expect(
        isPrefixOf(
          contentDeliveryQueryKey(TYPE, ITEM),
          contentDeliveryLocaleQueryKey(TYPE, ITEM, locale),
        ),
      ).toBe(true);
    }
  });

  it("is dropped with the record it belongs to", () => {
    expect(
      isPrefixOf(
        contentItemQueryRoot(TYPE, ITEM),
        contentDeliveryLocaleQueryKey(TYPE, ITEM, "en"),
      ),
    ).toBe(true);
  });
});

describe("paging the timeline", () => {
  it("appends pages in the order they were asked for", () => {
    expect(
      flattenContentRevisionPages([
        page([9, 8], { endCursor: 8, hasNextPage: true }),
        page([7, 6], { endCursor: 6, hasNextPage: false }),
      ]).map(edge => edge.id),
    ).toEqual([9, 8, 7, 6]);
  });

  it("keeps the first copy when a restore shifts the boundary row", () => {
    // The cursor is exclusive, so pages should be disjoint - but a restore
    // landing between two requests shifts every row down by one, and a
    // duplicated key is a React warning and a row drawn twice.
    expect(
      flattenContentRevisionPages([
        page([9, 8], { endCursor: 8, hasNextPage: true }),
        page([8, 7], { endCursor: 7, hasNextPage: false }),
      ]).map(edge => edge.id),
    ).toEqual([9, 8, 7]);
  });

  it("is empty for no pages at all", () => {
    expect(flattenContentRevisionPages([])).toEqual([]);
  });

  it("asks for the next page from the cursor the API named", () => {
    expect(
      nextContentRevisionCursor(page([9], { endCursor: 8, hasNextPage: true })),
    ).toBe(8);
  });

  it("stops when the API says there is no next page", () => {
    expect(
      nextContentRevisionCursor(
        page([9], { endCursor: 8, hasNextPage: false }),
      ),
    ).toBeUndefined();
  });

  it("stops on a null cursor rather than restarting from the top", () => {
    // `null` would be a falsy-but-present page param, and the route reads a
    // missing cursor as "start from the newest" - so it would page forever.
    expect(
      nextContentRevisionCursor(
        page([9], { endCursor: null, hasNextPage: true }),
      ),
    ).toBeUndefined();
  });
});
