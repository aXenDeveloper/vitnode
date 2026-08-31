// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";

import {
  CONTENT_USER_TARGET,
  contentDeliveryQueryKey,
  contentHistoryQueryKey,
  contentHistoryQueryRoot,
  contentItemQueryRoot,
  contentListQueryKey,
  contentListQueryRoot,
  contentOptionsQueryKey,
  contentOptionsQueryRoot,
  contentQueryRoot,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
  contentTypeQueryRoot,
} from "./content-query";

/**
 * The Content Engine's cache keys, as a shape rather than as a convention.
 *
 * Every assertion here is about **prefixes**, because that is the only property
 * TanStack Query actually uses: `invalidateQueries({ queryKey })` matches
 * element by element from the front, so "invalidate one content type" is correct
 * exactly when the type's root is a literal prefix of everything under it.
 */

const isPrefixOf = (
  prefix: readonly unknown[],
  key: readonly unknown[],
): boolean =>
  prefix.length <= key.length &&
  prefix.every((segment, index) => Object.is(segment, key[index]));

const TYPE = "blog.post";
const ITEM = 42;

describe("the content root", () => {
  it("is the AdminCP root plus one screen segment", () => {
    expect(contentQueryRoot()).toEqual([...ADMIN_QUERY_ROOT, "content"]);
  });

  /**
   * The whole of the sign-out story, and the reason the family lives here at
   * all. `removeAdminShellQueries` drops `ADMIN_QUERY_ROOT`; if that is a prefix
   * of every key below, the Content Engine's caches go with it and there is no
   * list for anybody to extend.
   *
   * The predecessor of this family keyed itself `["content-options", …]`, which
   * this assertion would have caught.
   */
  it("is collected by the AdminCP sign-out cleanup", () => {
    const everyKey = [
      contentQueryRoot(),
      contentTypeQueryRoot(TYPE),
      contentListQueryRoot(TYPE),
      contentListQueryKey(TYPE, { first: "25" }),
      contentItemQueryRoot(TYPE, ITEM),
      contentTranslationsQueryKey(TYPE, ITEM),
      contentHistoryQueryRoot(TYPE, ITEM),
      contentHistoryQueryKey(TYPE, ITEM, { first: "10" }),
      contentSchedulesQueryKey(TYPE, ITEM),
      contentDeliveryQueryKey(TYPE, ITEM),
      contentOptionsQueryRoot(TYPE),
      contentOptionsQueryKey(TYPE, "categoryId", "en"),
    ];

    everyKey.forEach(key => {
      expect(isPrefixOf(ADMIN_QUERY_ROOT, key), JSON.stringify(key)).toBe(true);
    });
  });

  /**
   * `["vitnode","admin"]` is not a prefix of `["vitnode","admin-session"]` -
   * Query matches whole segments - so a content invalidation can never reach the
   * permission set the shell renders from.
   */
  it("cannot collide with the admin session entry", () => {
    expect(contentQueryRoot()[1]).toBe("admin");
    expect(contentQueryRoot()[1]).not.toBe("admin-session");
  });
});

describe("one content type's root", () => {
  const root = contentTypeQueryRoot(TYPE);

  it.each([
    ["its list family", contentListQueryRoot(TYPE)],
    ["one list page", contentListQueryKey(TYPE, { first: "25" })],
    ["one record", contentItemQueryRoot(TYPE, ITEM)],
    ["its translations", contentTranslationsQueryKey(TYPE, ITEM)],
    ["its history", contentHistoryQueryRoot(TYPE, ITEM)],
    ["its schedules", contentSchedulesQueryKey(TYPE, ITEM)],
    ["its delivery state", contentDeliveryQueryKey(TYPE, ITEM)],
    ["every picker offering it", contentOptionsQueryRoot(TYPE)],
  ])("is a prefix of %s", (_name, key) => {
    expect(isPrefixOf(root, key)).toBe(true);
  });

  it("does not reach another content type", () => {
    expect(isPrefixOf(root, contentTypeQueryRoot("blog.category"))).toBe(false);
  });
});

describe("one record's root", () => {
  const root = contentItemQueryRoot(TYPE, ITEM);

  it.each([
    ["its translations", contentTranslationsQueryKey(TYPE, ITEM)],
    ["its history", contentHistoryQueryRoot(TYPE, ITEM)],
    ["one page of that history", contentHistoryQueryKey(TYPE, ITEM, {})],
    ["its schedules", contentSchedulesQueryKey(TYPE, ITEM)],
    ["its delivery state", contentDeliveryQueryKey(TYPE, ITEM)],
  ])("is a prefix of %s", (_name, key) => {
    expect(isPrefixOf(root, key)).toBe(true);
  });

  it("does not reach a sibling record", () => {
    expect(isPrefixOf(root, contentItemQueryRoot(TYPE, ITEM + 1))).toBe(false);
  });

  /**
   * The list is a sibling of the records, not a parent of them: a mutation that
   * removes one record must be able to invalidate the list without also naming
   * every other record's subtree, and vice versa.
   */
  it("is not reached by the list family, nor reaches it", () => {
    expect(isPrefixOf(contentListQueryRoot(TYPE), root)).toBe(false);
    expect(isPrefixOf(root, contentListQueryRoot(TYPE))).toBe(false);
  });
});

describe("reference picker options", () => {
  /**
   * The keying decision this family is arranged around: a picker is keyed by
   * *what it offers*, so creating a category expires the article form's category
   * picker without either screen knowing the other exists.
   */
  it("is reached by invalidating the content type it offers", () => {
    const picker = contentOptionsQueryKey("blog.category", "categoryId", "en");

    expect(isPrefixOf(contentTypeQueryRoot("blog.category"), picker)).toBe(
      true,
    );
    // And not by the type the *form* belongs to.
    expect(isPrefixOf(contentTypeQueryRoot("blog.post"), picker)).toBe(false);
  });

  it("keeps two fields onto one target independently searchable", () => {
    expect(
      contentOptionsQueryKey("blog.category", "primary", "en"),
    ).not.toEqual(contentOptionsQueryKey("blog.category", "secondary", "en"));
  });

  /**
   * A picker's labels are resolved in the reader's own language, so the same
   * category id reads differently for two administrators. Without the locale in
   * the key, switching the AdminCP language serves the previous language's
   * labels from cache until something else evicts them.
   */
  it("keys each AdminCP language separately", () => {
    expect(contentOptionsQueryKey(TYPE, "f", "en")).not.toEqual(
      contentOptionsQueryKey(TYPE, "f", "pl"),
    );
  });

  /**
   * And the search term is deliberately absent: `AutoFormCombobox` appends
   * `{ search }` to whatever key it is handed, so this is the prefix a picker
   * caches under rather than a whole entry. Naming it here too would put it in
   * the key twice.
   */
  it("is a prefix of what the combobox actually caches under", () => {
    const key = contentOptionsQueryKey(TYPE, "f", "en");

    expect(isPrefixOf(key, [...key, { search: "ab" }])).toBe(true);
  });

  /**
   * A `user` picker offers people rather than a content type, and its bucket
   * must be unreachable by any content mutation. `CONTENT_ID_PATTERN` allows
   * only lowercase alphanumerics and dots, so a colon cannot be a content type
   * id - which is what makes this token safe.
   */
  it("puts the user picker somewhere no content type can name", () => {
    expect(CONTENT_USER_TARGET).toContain(":");
    expect(/^[a-z0-9]+(?:\.[a-z0-9-]+)+$/.test(CONTENT_USER_TARGET)).toBe(
      false,
    );
  });
});
