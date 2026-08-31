import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { describe, expectTypeOf, it } from "vitest";

import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";

import { adminContent } from "./admin/content";

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

  /**
   * The browser-safe module an application's generated registry imports.
   *
   * `satisfies` in the module itself is what checks it; this states the
   * contract from the consumer's side, which is the side that breaks silently -
   * a plugin that renamed the export or widened its `pluginId` would still build
   * and would simply contribute nothing.
   */
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
