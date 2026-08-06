// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentRevisionSnapshot } from "./revisions";

import { contentRevisionDiff } from "./revisions";

const snapshot = (
  fields: ContentRevisionSnapshot["fields"],
): ContentRevisionSnapshot => ({
  contentTypeId: "test.editorial",
  createdAt: "2024-01-01T00:00:00.000Z",
  fields,
  id: 1,
  schemaVersion: 1,
  updatedAt: "2024-01-01T00:00:00.000Z",
  version: 1,
});

const names = ["title", "excerpt", "views", "featured", "publishedOn"];

describe("contentRevisionDiff", () => {
  it("reports only the fields that moved", () => {
    const before = snapshot({ excerpt: "Old", title: "Hello", views: 1 });
    const after = snapshot({ excerpt: "Old", title: "Goodbye", views: 2 });

    expect(contentRevisionDiff(names, before, after)).toEqual([
      { after: "Goodbye", before: "Hello", name: "title" },
      { after: 2, before: 1, name: "views" },
    ]);
  });

  it("keeps the content type's declaration order", () => {
    const before = snapshot({ excerpt: "a", title: "a", views: 1 });
    const after = snapshot({ excerpt: "b", title: "b", views: 2 });

    expect(contentRevisionDiff(names, before, after).map(e => e.name)).toEqual([
      "title",
      "excerpt",
      "views",
    ]);
  });

  it("distinguishes an explicit null from an absent field", () => {
    const before = snapshot({ excerpt: "Old", title: "Hello" });
    const after = snapshot({ excerpt: null, title: "Hello" });

    expect(contentRevisionDiff(names, before, after)).toEqual([
      { after: null, before: "Old", name: "excerpt" },
    ]);
  });

  it("ignores a field neither snapshot carries", () => {
    const before = snapshot({ title: "Hello" });
    const after = snapshot({ title: "Hello" });

    expect(contentRevisionDiff(names, before, after)).toEqual([]);
  });

  it("skips a field the content type no longer declares", () => {
    // Present in both snapshots, absent from `names` - it is history, not a
    // change, and showing it would invite a restore that cannot happen.
    const before = snapshot({ sinceRemoved: "a", title: "Hello" });
    const after = snapshot({ sinceRemoved: "b", title: "Hello" });

    expect(contentRevisionDiff(names, before, after)).toEqual([]);
  });

  it("treats a create as every field being new", () => {
    const after = snapshot({ excerpt: null, title: "Hello", views: 0 });

    // No previous revision, so nothing is compared away.
    expect(contentRevisionDiff(names, null, after)).toEqual([
      { after: "Hello", before: undefined, name: "title" },
      { after: null, before: undefined, name: "excerpt" },
      { after: 0, before: undefined, name: "views" },
      { after: undefined, before: undefined, name: "featured" },
      { after: undefined, before: undefined, name: "publishedOn" },
    ]);
  });

  it("handles booleans and zero without treating them as absent", () => {
    const before = snapshot({ featured: true, views: 0 });
    const after = snapshot({ featured: false, views: 0 });

    expect(contentRevisionDiff(names, before, after)).toEqual([
      { after: false, before: true, name: "featured" },
    ]);
  });
});
