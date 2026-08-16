import { defineContentType, field } from "@vitnode/core/content";

/**
 * Blog categories, as a Content Engine content type.
 *
 * The **simple** reference implementation: two fields, generated CRUD, and
 * dialog create/edit. It exists to show that a small record needs no page-mode
 * editor - and, between them, that `admin.create.mode` really is per content
 * type rather than per install.
 *
 * `tableName` is deliberately the table the plugin has always used. The
 * Content Engine's generated schema for this shape *is* `blog_categories` plus a
 * translation table, so the migration adds rather than replaces: no ids move, no
 * rows are copied between tables, and an install with categories keeps them.
 *
 * `name` is localized because it always was - the blog stored category titles in
 * `core_languages_words`, one row per language - and it moves into
 * `blog_categories_translations`, which is where the engine keeps the same idea.
 * `color` is shared, because a colour is a property of the category and not of
 * the language somebody is reading it in.
 */
export const blogCategoryContentType = defineContentType({
  id: "blog.category",
  tableName: "blog_categories",

  localization: {
    enabled: true,
    // The language every category is first written in. `en` is the locale
    // VitNode installs seed, and the boot guard says so loudly if an install
    // does not have it rather than failing on the first write.
    defaultLocale: "en",
    fallback: "default",
  },

  fields: {
    name: field.text({
      localized: true,
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    color: field.text({ maxLength: 50, nullable: true }),
  },

  admin: {
    permissionModule: "categories",
    // Plural, like the list it opens - and like every other AdminCP address.
    path: "blog/categories",
    colorField: "color",
    titleField: "name",
    // Dialogs, deliberately: a name and a colour do not need a page, and this is
    // the half of the blog that proves page mode is opt-in.
    create: { mode: "dialog" },
    edit: { mode: "dialog" },
    list: {
      // `name` first, because it is what a category *is*. It comes off the
      // translation the list resolved for the reader's own language, so there is
      // nothing above the table to choose.
      columns: ["name", "color", "updatedAt"],
    },
  },
});
