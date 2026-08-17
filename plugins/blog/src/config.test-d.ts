import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { describe, expectTypeOf, it } from "vitest";

import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

/**
 * What the frontend registration will and will not accept.
 *
 * The registration is checked against the definition's own field names, so a
 * renamed field is a compile error at the override rather than an input that
 * silently stops being overridden.
 */
describe("blog content admin registration", () => {
  it("accepts overrides for fields the content type has", () => {
    contentTypeAdmin({
      definition: blogCategoryContentType,
      fields: { color: { component: () => null } },
      columns: { color: { cell: () => null } },
    });

    contentTypeAdmin({
      definition: blogPostContentType,
      fields: { content: { component: () => null } },
      forms: { layout: () => null },
    });
  });

  it("refuses an override for a field that does not exist", () => {
    contentTypeAdmin({
      definition: blogCategoryContentType,
      // @ts-expect-error - the category has no `colour`
      fields: { colour: { component: () => null } },
    });

    contentTypeAdmin({
      definition: blogPostContentType,
      // @ts-expect-error - the article's body is `content`, not `body`
      fields: { body: { component: () => null } },
    });
  });

  it("keeps the presentation modes literal", () => {
    expectTypeOf(blogPostContentType.admin.create.mode).toEqualTypeOf<
      "dialog" | "page"
    >();
    expectTypeOf(blogCategoryContentType.admin.edit.mode).toEqualTypeOf<
      "dialog" | "page"
    >();
  });
});
