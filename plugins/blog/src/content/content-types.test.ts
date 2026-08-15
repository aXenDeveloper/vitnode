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

    it("names itself by the localized name, in the reader's language", () => {
      // Left undefined the engine would pick `color`, and "#3260c0 has been
      // deleted" is not a sentence anybody wants to read. `name` lives on the
      // translation table, and the AdminCP resolves it per reader.
      expect(blogCategoryContentType.admin.titleField).toBe("name");
    });

    it("leads the list with the name, in the reader's language", () => {
      expect(blogCategoryContentType.admin.list.columns).toEqual([
        "name",
        "color",
        "updatedAt",
      ]);
    });

    it("keeps the list sortable by shared columns only", () => {
      // A localized column is one column on the *translation* table. Showing it
      // is fine; ordering by it would reshuffle the list per reader and make one
      // cursor mean two positions.
      expect(blogCategoryContentType.admin.list.orderableFields).not.toContain(
        "name",
      );
    });
  });

  describe("the article, the rich example", () => {
    it("creates and edits on a page", () => {
      expect(blogPostContentType.admin.create.mode).toBe("page");
      expect(blogPostContentType.admin.edit.mode).toBe("page");
    });

    it("holds many categories, and refuses to orphan an article", () => {
      const relation = blogPostContentType.fields.categoryId;

      expect(relation.kind).toBe("relation");
      // Never `required` - a to-many reference cannot be, because the empty set
      // is what "no categories" looks like. "At least one" is the plugin's own
      // rule, enforced on write; see `assertPostHasCategory`.
      expect(relation.required).toBe(false);
      expect(relation).toMatchObject({ multiple: true, onDelete: "restrict" });
    });

    it("holds many authors, in the order of the byline", () => {
      const author = blogPostContentType.fields.authorId;

      expect(author.kind).toBe("user");
      expect(author).toMatchObject({ multiple: true, ordered: true });
      // `cascade`, not the `set null` a single author had: a junction row has no
      // column to null, so a deleted account loses its membership and the
      // article survives - which is what the nullable column was protecting.
      expect(author).toMatchObject({ nullable: false, onDelete: "cascade" });
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

    it("names itself by the localized title, in the reader's language", () => {
      expect(blogPostContentType.admin.titleField).toBe("title");
    });

    it("leads the list with the title, in the reader's language", () => {
      expect(blogPostContentType.admin.list.columns[0]).toBe("title");
    });

    it("keeps the list sortable by shared columns only", () => {
      expect(blogPostContentType.admin.list.orderableFields).not.toContain(
        "title",
      );
    });

    it("puts the localized and the shared fields in one form", () => {
      // One screen: the title, the body and the URL carry their own language
      // switchers, and the category and the author do not. Nothing here says
      // which is which, and the layout does not have to either.
      expect(blogPostContentType.admin.form.fields).toEqual([
        "categoryId",
        "authorId",
        "title",
        "friendlyUrl",
        "content",
      ]);
    });

    it("keeps the storage model: a base row plus a translation table", () => {
      // The field-level language switchers change how localization is *edited*.
      // Where it lives has not moved.
      expect(blogPostContentType.localization.translationTableName).toBe(
        "blog_posts_translations",
      );
      expect(blogPostContentType.fields.categoryId.localized).toBeFalsy();
      expect(blogPostContentType.fields.authorId.localized).toBeFalsy();
    });
  });
});
