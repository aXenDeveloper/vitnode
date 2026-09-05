import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { describe, expectTypeOf, it } from "vitest";

import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

import { adminContent } from "./admin/content";

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

  it("exports a content source the generated registry can consume", () => {
    expectTypeOf(adminContent).toExtend<ContentFrontendPluginSource>();
    expectTypeOf(adminContent.pluginId).toEqualTypeOf<"@vitnode/blog">();
    expectTypeOf(adminContent.contentTypes).not.toBeUndefined();
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
