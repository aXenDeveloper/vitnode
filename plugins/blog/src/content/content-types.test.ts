// @vitest-environment node
import { describe, expect, it } from "vitest";

import { blogCategoryContentType } from "./category";
import { blogPostContentType } from "./post";

/**
 * What the blog's two content types promise, stated as facts rather than as a
 * snapshot of the descriptor.
 *
 * Every assertion here is something an install would notice if it changed: a
 * table name, a permission module, a public URL, a presentation mode. They are
 * the compatibility contract of the migration.
 */
describe("blog content types", () => {
  describe("compatibility with the pre-migration plugin", () => {
    it("keeps the table names, so no data has to move", () => {
      expect(blogCategoryContentType.tableName).toBe("blog_categories");
      expect(blogPostContentType.tableName).toBe("blog_posts");
    });

    it("keeps the column names of the relation and the author", () => {
      expect(Object.keys(blogPostContentType.fields)).toContain("categoryId");
      expect(Object.keys(blogPostContentType.fields)).toContain("authorId");
    });

    it("keeps the staff permission modules every role is stored against", () => {
      expect(blogCategoryContentType.permissionModule).toBe("categories");
      expect(blogPostContentType.permissionModule).toBe("posts");
    });

    it("keeps the public URL prefix", () => {
      expect(blogPostContentType.publicApi.path).toBe("blog");
    });
  });

  describe("the category, the simple example", () => {
    it("creates and edits in a dialog", () => {
      expect(blogCategoryContentType.admin.create.mode).toBe("dialog");
      expect(blogCategoryContentType.admin.edit.mode).toBe("dialog");
    });

    it("keeps the colour shared and the name per language", () => {
      expect(blogCategoryContentType.fields.color.localized).toBe(false);
      expect(blogCategoryContentType.fields.name.localized).toBe(true);
    });

    it("has no shared title to guess at", () => {
      // Left undefined the engine would pick `color`, and "#3260c0 has been
      // deleted" is not a sentence anybody wants to read.
      expect(blogCategoryContentType.admin.titleField).toBeNull();
    });

    it("shows only shared columns in the list", () => {
      expect(blogCategoryContentType.admin.list.columns).toEqual([
        "color",
        "updatedAt",
      ]);
    });
  });

  describe("the article, the rich example", () => {
    it("creates and edits on a page", () => {
      expect(blogPostContentType.admin.create.mode).toBe("page");
      expect(blogPostContentType.admin.edit.mode).toBe("page");
    });

    it("relates to the category, and refuses to orphan an article", () => {
      const relation = blogPostContentType.fields.categoryId;

      expect(relation.kind).toBe("relation");
      expect(relation.required).toBe(true);
      expect(relation).toMatchObject({ onDelete: "restrict" });
    });

    it("keeps the three translated fields per language", () => {
      expect(blogPostContentType.fields.title.localized).toBe(true);
      expect(blogPostContentType.fields.friendlyUrl.localized).toBe(true);
      expect(blogPostContentType.fields.content.localized).toBe(true);
      expect(blogPostContentType.localization.enabled).toBe(true);
    });

    it("derives the friendly URL from the title, per language", () => {
      expect(blogPostContentType.fields.friendlyUrl).toMatchObject({
        kind: "slug",
        source: "title",
      });
    });

    it("has publication and the editorial workflow", () => {
      expect(blogPostContentType.publication.enabled).toBe(true);
      expect(blogPostContentType.editorial.enabled).toBe(true);
      expect(blogPostContentType.editorial.preview.enabled).toBe(true);
      expect(blogPostContentType.editorial.scheduling.enabled).toBe(true);
    });

    it("indexes itself through the engine rather than a plugin indexer", () => {
      expect(blogPostContentType.search.enabled).toBe(true);
      expect(blogPostContentType.search.titleField).toBe("title");
      expect(blogPostContentType.search.pathTemplate).toBe(
        "/{locale}/blog/{slug}",
      );
    });

    it("owns its public URLs through delivery, redirects included", () => {
      expect(blogPostContentType.delivery.enabled).toBe(true);
      expect(blogPostContentType.delivery.redirects.enabled).toBe(true);
      expect(blogPostContentType.delivery.sitemap.enabled).toBe(true);
    });

    it("never exposes the author publicly", () => {
      expect(blogPostContentType.publicApi.fields).not.toContain("authorId");
    });
  });
});
