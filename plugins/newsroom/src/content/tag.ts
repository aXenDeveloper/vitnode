import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

export const tagContentType = defineContentType({
  id: "newsroom.tag",
  tableName: "newsroom_tags",
  idStrategy: "uuid",

  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  visibility: true,
  duplication: true,
  editorial: {
    revisions: { retention: 20 },
    preview: { expiresInMinutes: 30 },
  },

  fields: {
    name: field.text({
      localized: true,
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    slug: field.slug({ localized: true, source: "name" }),

    category: field.relation({
      nullable: true,
      onDelete: "set null",
      target: () => categoryContentType,
    }),

    relatedTags: field.relation({
      multiple: true,
      onDelete: "cascade",
      ordered: true,
      self: true,
    }),
  },

  publicApi: {
    path: "tags",
    fields: ["id", "name", "slug", "category", "relatedTags", "publishedAt"],
    filterableFields: ["relatedTags"],
    defaultOrderBy: "publishedAt",
  },

  admin: {
    titleField: "name",
    list: { columns: ["status", "updatedAt"] },
    form: { fields: ["name", "slug", "category", "relatedTags"] },
  },
});
