// @vitest-environment node
import { describe, expect, it } from "vitest";

import { blogCategoryContentType } from "./category";
import { blogPostContentType } from "./post";

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
      // rule, and `min: 1` on the field is where it is enforced.
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
        "coverImage",
        "coverImageAlt",
      ]);
    });

    describe("the cover image", () => {
      const cover = blogPostContentType.fields.coverImage;

      it("is one shared file, never per language", () => {
        expect(cover.kind).toBe("file");
        expect(cover.localized).toBeFalsy();
      });

      it("states a ceiling, because every file field has to", () => {
        expect(cover).toMatchObject({ maxBytes: 5 * 1024 * 1024 });
      });

      it("constrains the extension and the media type independently", () => {
        // Both, so a `hero.png` declared `image/gif` is refused - which an
        // extension-only check would store.
        expect(cover).toMatchObject({
          allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/avif",
          ],
        });
      });

      it("allows the format the image pipeline converts to", () => {
        // With `storage.image` on, an upload is stored as WebP whatever was
        // chosen - so a field that left `.webp` out would accept the upload and
        // then refuse the save.
        expect(cover).toMatchObject({
          allowedExtensions: expect.arrayContaining([".webp"]),
          allowedMimeTypes: expect.arrayContaining(["image/webp"]),
        });
      });

      it("is optional, so an article can exist before its image does", () => {
        expect(cover.nullable).toBe(true);
        expect(cover.required).toBe(false);
      });

      it("describes itself per language", () => {
        const alt = blogPostContentType.fields.coverImageAlt;

        expect(alt.kind).toBe("text");
        expect(alt.localized).toBe(true);
        expect(alt.nullable).toBe(true);
      });

      it("is publicly readable, alt text included", () => {
        expect(blogPostContentType.publicApi.fields).toContain("coverImage");
        expect(blogPostContentType.publicApi.fields).toContain("coverImageAlt");
      });

      it("is neither sortable nor filterable", () => {
        expect(blogPostContentType.admin.list.orderableFields).not.toContain(
          "coverImage",
        );
        expect(blogPostContentType.publicApi.filterableFields).not.toContain(
          "coverImage",
        );
        expect(blogPostContentType.publicApi.orderableFields).not.toContain(
          "coverImage",
        );
      });

      it("shows in the list beside the title, not instead of it", () => {
        expect(blogPostContentType.admin.list.columns).toContain("coverImage");
        expect(blogPostContentType.admin.list.columns[0]).toBe("title");
      });
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
