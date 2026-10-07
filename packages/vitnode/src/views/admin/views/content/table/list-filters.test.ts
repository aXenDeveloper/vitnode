// @vitest-environment node
import { describe, expect, it } from "vitest";

import { nextFilterSelection } from "@/components/table/filters";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";

import {
  contentListSystemFilterValue,
  contentListToolbarFilters,
} from "./list-filters";

const LABELS = {
  all: "All",
  status: { draft: "Draft", label: "Status", published: "Published" },
  visibility: { hidden: "Hidden", label: "Visibility", visible: "Visible" },
};

const fields = { title: field.text({ required: true }) };

const articles = defineContentType({
  id: "blog.post",
  tableName: "blog_posts",
  publication: { enabled: true },
  visibility: { enabled: true },
  fields,
});

const pages = defineContentType({
  id: "site.page",
  tableName: "site_pages",
  publication: { enabled: true },
  fields,
});

const notes = defineContentType({
  id: "site.note",
  tableName: "site_notes",
  fields,
});

describe("contentListToolbarFilters", () => {
  it("offers status and visibility side by side, each one value at a time", () => {
    const filters = contentListToolbarFilters(articles, LABELS);

    expect(filters.map(filter => filter.id)).toEqual(["status", "visibility"]);
    expect(filters[1]).toEqual({
      id: "visibility",
      label: "Visibility",
      options: [
        { label: "Visible", value: "visible" },
        { label: "Hidden", value: "hidden" },
      ],
      single: { allLabel: "All" },
    });
  });

  it("offers status alone for a content type that does not hide", () => {
    expect(
      contentListToolbarFilters(pages, LABELS).map(filter => filter.id),
    ).toEqual(["status"]);
  });

  it("offers nothing for a content type without publication", () => {
    expect(contentListToolbarFilters(notes, LABELS)).toEqual([]);
  });
});

describe("contentListSystemFilterValue", () => {
  it("keeps exactly one allowed value", () => {
    expect(contentListSystemFilterValue("visibility", "hidden")).toBe("hidden");
    expect(contentListSystemFilterValue("visibility", "visible")).toBe(
      "visible",
    );
    expect(contentListSystemFilterValue("status", "draft")).toBe("draft");
  });

  it("reads anything else as all, instead of a 400 from the API", () => {
    expect(
      contentListSystemFilterValue("visibility", "hidden,visible"),
    ).toBeUndefined();
    expect(
      contentListSystemFilterValue("visibility", "secret"),
    ).toBeUndefined();
    expect(contentListSystemFilterValue("status", "archived")).toBeUndefined();
  });

  it("leaves a declared field's filter to the API", () => {
    expect(contentListSystemFilterValue("categoryId", "7")).toBe("7");
  });
});

describe("nextFilterSelection", () => {
  it("replaces the value of a single-value filter, and clears it on a second pick", () => {
    expect(nextFilterSelection([], "hidden", true)).toEqual(["hidden"]);
    expect(nextFilterSelection(["hidden"], "visible", true)).toEqual([
      "visible",
    ]);
    expect(nextFilterSelection(["hidden"], "hidden", true)).toEqual([]);
  });

  it("toggles one value of a multi-value filter, keeping the rest", () => {
    expect(nextFilterSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(nextFilterSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});
