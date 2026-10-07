import type { ContentRelationTarget } from "@vitnode/core/content";

import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";
import { tagContentType } from "./tag";

/**
 * An event keyed by `bigint`: a Postgres identity column read in Drizzle's
 * `string` mode, so an id beyond `Number.MAX_SAFE_INTEGER` crosses every API as
 * its exact decimal string rather than a rounded number.
 *
 * Its relations cover every combination a mixed install has: a `bigint` record
 * pointing at a `uuid` one (`primaryTag`, `tags`), at a `serial` one
 * (`category`) and at itself (`relatedEvents`, a bigint self-relation). The
 * repeatable's children keep `serial` ids of their own whatever the owner uses.
 */
export const eventContentType = defineContentType({
  id: "example.event",
  tableName: "example_events",
  idStrategy: "bigint",

  localization: { enabled: true, defaultLocale: "en", fallback: "default" },
  publication: { enabled: true },
  visibility: { enabled: true },
  duplication: { enabled: true },
  editorial: {
    enabled: true,
    revisions: { retention: 20 },
    preview: { enabled: true, expiresInMinutes: 30 },
    scheduling: { enabled: true },
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

    // The annotation keeps the target's strategy in the type even if the two
    // modules ever import each other: a mutual relation needs one, exactly as a
    // circular `const` does.
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
    enabled: true,
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
    enabled: true,
    titleField: "title",
    contentFields: ["title", "body", "sessions.title"],
    pathTemplate: "/events/{slug}",
  },

  delivery: {
    enabled: true,
    redirects: { enabled: true },
    hreflang: { xDefault: "defaultLocale" },
    seo: { titleField: "title", descriptionField: "body" },
    sitemap: { enabled: true, changeFrequency: "weekly" },
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
