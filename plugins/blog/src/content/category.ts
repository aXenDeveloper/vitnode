import { defineContentType, field } from "@vitnode/core/content";

/**
 * The blog category (`blog.category`, table `blog_categories`): a localized
 * name, with `en` as the fallback translation, and a shared colour.
 *
 * Deliberately minimal - no publication lifecycle and no `publicApi`, so
 * categories are managed only in the AdminCP (in dialogs) and reach readers
 * only through an article's `categoryId`.
 *
 * Browser-safe: the server model is `categoryContent` in
 * `@vitnode/blog/database/categories`.
 */
export const blogCategoryContentType = defineContentType({
  id: "blog.category",
  tableName: "blog_categories",

  localization: {
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
