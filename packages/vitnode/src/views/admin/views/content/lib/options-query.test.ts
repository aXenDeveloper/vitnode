// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { CONTENT_USER_TARGET, contentOptionsQueryRoot } from "../content-query";
import {
  contentOptionsQueryKey,
  contentOptionsQueryKeyFor,
  contentOptionsTarget,
} from "./options-query";

const field = (
  name: string,
  targetContentTypeId?: string,
): ContentFormFieldSpec => ({
  kind: targetContentTypeId === undefined ? "user" : "relation",
  label: name,
  name,
  nullable: true,
  required: false,
  ...(targetContentTypeId === undefined ? {} : { targetContentTypeId }),
});

const category = field("categoryId", "blog.category");
const author = field("authorId");

describe("contentOptionsTarget", () => {
  it("is the content type a relation points at", () => {
    expect(contentOptionsTarget(category)).toBe("blog.category");
  });

  it("is a token of its own for a user field, because people are not a content type", () => {
    // It has to be a token no content type id can collide with, or a content
    // mutation would expire the people picker - or worse, match it.
    expect(contentOptionsTarget(author)).toBe(CONTENT_USER_TARGET);
    expect(CONTENT_USER_TARGET).toContain(":");
  });
});

describe("contentOptionsQueryKey", () => {
  it("starts with the root a mutation invalidates", () => {
    // The whole invalidation story: TanStack Query matches by prefix, so this is
    // what lets creating a category expire the article form's category picker
    // without either screen knowing the other exists.
    const root = contentOptionsQueryRoot("blog.category");

    expect(
      contentOptionsQueryKey(category, "en").slice(0, root.length),
    ).toEqual([...root]);
  });

  it("separates two fields onto the same target", () => {
    // A primary and a secondary category are searched independently.
    expect(
      contentOptionsQueryKey(field("primary", "blog.category"), "en"),
    ).not.toEqual(
      contentOptionsQueryKey(field("secondary", "blog.category"), "en"),
    );
  });

  it("separates two content types", () => {
    expect(contentOptionsQueryKey(category, "en")).not.toEqual(
      contentOptionsQueryKey(field("categoryId", "docs.category"), "en"),
    );
  });

  it("separates two languages", () => {
    // A picker onto a localized content type reads its labels through
    // `core_languages_words`, so the same id reads "News" for one editor and
    // "Aktualnosci" for another. Sharing an entry shows the wrong text.
    expect(contentOptionsQueryKey(category, "en")).not.toEqual(
      contentOptionsQueryKey(category, "pl"),
    );
  });

  it("separates a user picker from every content type's picker", () => {
    expect(contentOptionsQueryKey(author, "en")).not.toEqual(
      contentOptionsQueryKey(category, "en"),
    );
  });

  it("is stable for the same field and language", () => {
    expect(contentOptionsQueryKey(category, "en")).toEqual(
      contentOptionsQueryKey(field("categoryId", "blog.category"), "en"),
    );
  });

  it("leaves the search off, because the combobox appends it", () => {
    // `AutoFormCombobox` owns the debounced search term and appends `{ search }`
    // to whatever key it is handed. Naming it here too would key it twice.
    expect(contentOptionsQueryKey(category, "en")).toEqual([
      ...contentOptionsQueryRoot("blog.category"),
      "categoryId",
      "en",
    ]);
  });
});

describe("contentOptionsQueryKeyFor", () => {
  it("is a prefix of every picker onto that content type", () => {
    const root = contentOptionsQueryKeyFor("blog.category");
    const key = contentOptionsQueryKey(category, "pl");

    expect(key.slice(0, root.length)).toEqual([...root]);
  });

  it("does not reach a picker onto a different content type", () => {
    const root = contentOptionsQueryKeyFor("blog.category");
    const other = contentOptionsQueryKey(field("x", "docs.category"), "pl");

    expect(other.slice(0, root.length)).not.toEqual([...root]);
  });

  it("does not reach the people picker", () => {
    // No content type id may be spelled with a colon, which is what makes this
    // impossible rather than merely unlikely.
    const root = contentOptionsQueryKeyFor("blog.category");
    const people = contentOptionsQueryKey(author, "pl");

    expect(people.slice(0, root.length)).not.toEqual([...root]);
  });
});
