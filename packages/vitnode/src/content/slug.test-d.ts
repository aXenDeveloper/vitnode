import { assertType, describe, it } from "vitest";

import type { testPostContentType } from "@/tests/content-fixtures";

import type { ContentCreateInput } from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Post = typeof testPostContentType;

describe("field.slug", () => {
  it("takes neither `required` nor `nullable`", () => {
    // @ts-expect-error - `required` is a consequence of `source`
    field.slug({ required: true, source: "title" });
    // @ts-expect-error - a slug is always NOT NULL
    field.slug({ nullable: true });
  });

  it("is optional on create only when it has a source", () => {
    const manual = defineContentType({
      id: "test.manual-slug-type",
      tableName: "test_manual_slug_types",
      fields: {
        title: field.text({ required: true }),
        slug: field.slug(),
      },
    });

    assertType<ContentCreateInput<Post>>({ category: 1, title: "Hello" });
    // @ts-expect-error - nothing can derive this one
    assertType<ContentCreateInput<typeof manual>>({ title: "Hello" });
  });

  it("rejects a non-string value", () => {
    assertType<ContentCreateInput<Post>>({
      category: 1,
      // @ts-expect-error - a slug is text
      slug: 12,
      title: "Hello",
    });
  });
});
