import { describe, expect, it } from "vitest";

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
  publication: true,
  visibility: true,
  fields,
});

const pages = defineContentType({
  id: "site.page",
  tableName: "site_pages",
  publication: true,
  fields,
});

const notes = defineContentType({
  id: "site.note",
  tableName: "site_notes",
  fields,
});

describe("contentListToolbarFilters", () => {
  it.each([
    [
      "status and visibility for a content type that hides",
      articles,
      ["status", "visibility"],
    ],
    ["status alone for a content type that does not hide", pages, ["status"]],
    ["nothing for a content type without publication", notes, []],
  ])("offers %s", (_name, definition, ids) => {
    expect(
      contentListToolbarFilters(definition, LABELS).map(filter => filter.id),
    ).toEqual(ids);
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
