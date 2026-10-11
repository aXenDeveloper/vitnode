import type { ContentRelationTarget } from "@vitnode/core/content";

import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";
import { tagContentType } from "./tag";

export const eventContentType = defineContentType({
  id: "example.event",
  tableName: "example_events",
  idStrategy: "bigint",

  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  visibility: true,
  duplication: true,
  editorial: {
    revisions: { retention: 20 },
    preview: { expiresInMinutes: 30 },
    scheduling: true,
  },

  fields: {
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 200,
    }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.richText({ localized: true, nullable: true }),

    primaryTag: field.relation({
      nullable: true,
      onDelete: "set null",
      target: (): ContentRelationTarget<"uuid"> => tagContentType,
    }),
    category: field.relation({
      nullable: true,
      onDelete: "set null",
      target: () => categoryContentType,
    }),
    tags: field.relation({
      multiple: true,
      ordered: true,
      target: () => tagContentType,
    }),
    relatedEvents: field.relation({
      multiple: true,
      onDelete: "cascade",
      self: true,
    }),

    sessions: field.repeatable({
      max: 20,
      fields: {
        title: field.text({ required: true, minLength: 1, maxLength: 200 }),
        startsAt: field.dateTime({ nullable: true }),
      },
    }),
    gallery: field.file({
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 5 * 1024 * 1024,
      multiple: true,
    }),
  },

  publicApi: {
    path: "events",
    fields: [
      "id",
      "title",
      "slug",
      "body",
      "primaryTag",
      "category",
      "tags",
      "relatedEvents",
      "sessions.title",
      "sessions.startsAt",
      "gallery",
      "publishedAt",
    ],
    filterableFields: ["tags", "category"],
    defaultOrderBy: "publishedAt",
  },

  search: {
    titleField: "title",
    contentFields: ["title", "body", "sessions.title"],
    pathTemplate: "/events/{slug}",
  },

  delivery: {
    redirects: true,
    hreflang: { xDefault: "defaultLocale" },
    seo: { titleField: "title", descriptionField: "body" },
    sitemap: { changeFrequency: "weekly" },
  },

  admin: {
    titleField: "title",
    list: { columns: ["status", "updatedAt"] },
    form: {
      fields: [
        "title",
        "slug",
        "body",
        "primaryTag",
        "category",
        "tags",
        "relatedEvents",
        "sessions",
        "gallery",
      ],
    },
  },
});
