import { defineContentType, field } from "@vitnode/core/content";

import { forumContainers } from "@/content/forums";

export const topicContentType = defineContentType({
  id: "forum.topic",
  tableName: "forum_topics",

  fields: {
    title: field.text({ required: true, minLength: 3, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
    author: field.user(),
    forum: field.container({ definition: forumContainers, required: true }),
  },

  publication: true,
  visibility: true,
  editorial: { revisions: { retention: 20 } },

  indexes: [{ on: ["forum", "publishedAt"] }],

  publicApi: {
    path: "topics",
    fields: [
      "id",
      "title",
      "slug",
      "body",
      "forum",
      "publishedAt",
      "createdAt",
      "updatedAt",
    ],
    filterableFields: ["forum"],
    orderableFields: ["publishedAt", "updatedAt"],
    people: ["author"],
  },

  publicWrite: {
    ownership: { field: "author" },
    create: { fields: ["title", "body", "forum"], status: "published" },
    update: { fields: ["title", "body"] },
  },

  delivery: {
    path: "/forum/topics/:slug",
    redirects: true,
    seo: { titleField: "title", descriptionField: "body" },
    sitemap: { changeFrequency: "daily", priority: 0.6 },
  },

  search: {
    titleField: "title",
    contentFields: ["body"],
    authorField: "author",
    pathTemplate: "/forum/topics/{slug}",
    context: { field: "forum", pathTemplate: "/forum/{slug}" },
  },

  admin: { titleField: "title" },
});
