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

  it("is not reached by the list family, nor reaches it", () => {
    expect(isPrefixOf(contentListQueryRoot(TYPE), root)).toBe(false);
    expect(isPrefixOf(root, contentListQueryRoot(TYPE))).toBe(false);
  });
});

describe("reference picker options", () => {
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

  it("keys each AdminCP language separately", () => {
    expect(contentOptionsQueryKey(TYPE, "f", "en")).not.toEqual(
      contentOptionsQueryKey(TYPE, "f", "pl"),
    );
  });

  it("is a prefix of what the combobox actually caches under", () => {
    const key = contentOptionsQueryKey(TYPE, "f", "en");

    expect(isPrefixOf(key, [...key, { search: "ab" }])).toBe(true);
  });

  it("puts the user picker somewhere no content type can name", () => {
    expect(CONTENT_USER_TARGET).toContain(":");
    expect(/^[a-z0-9]+(?:\.[a-z0-9-]+)+$/.test(CONTENT_USER_TARGET)).toBe(
      false,
    );
  });
});
