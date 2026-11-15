import { z } from "@hono/zod-openapi";

import { zodPaginationQuery } from "../../lib/with-pagination";

const zodSearchPageInfo = z.object({
  totalCount: z.number(),
  count: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.number().nullable(),
  endCursor: z.number().nullable(),
});

export const zodSearchHitAuthor = z.object({
  id: z.number(),
  name: z.string(),
  nameCode: z.string(),
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
});

export const zodSearchHitSchema = z.object({
  id: z.number(),
  pluginId: z.string(),
  itemType: z.string(),
  itemId: z.union([z.number().int(), z.string().max(64)]),
  languageCode: z.string(),
  authorId: z.number().nullable(),
  title: z.string(),
  content: z.string(),
  containerType: z.string().nullable(),
  containerId: z.number().nullable(),
  url: z.string().nullable(),
  isPublic: z.boolean(),
  isHidden: z.boolean(),
  image: z
    .object({
      url: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .nullable(),
  imageId: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  score: z.number().nullable(),
  author: zodSearchHitAuthor.nullable(),
  authorIds: z.array(z.number()),
  authors: z.array(zodSearchHitAuthor),
});

export const zodSearchResultSchema = z.object({
  edges: z.array(zodSearchHitSchema),
  // The search index has its own pagination - a relevance-sorted page walks by
  // offset, and an ordinary one by row id - so it keeps the numeric cursors it
  // has always had rather than the opaque keyset cursor `withPagination` mints
  // for a table.
  pageInfo: zodSearchPageInfo,
});

export const zodSearchSuggestion = z.object({
  context: z.string().nullable(),
  createdAt: z.date(),
  excerpt: z.string(),
  id: z.number(),
  image: z
    .object({
      height: z.number().optional(),
      url: z.string(),
      width: z.number().optional(),
    })
    .nullable(),
  itemId: z.string(),
  itemType: z.string(),
  title: z.string(),
  url: z.string(),
});

export const zodSearchTimelineQuery = zodPaginationQuery.extend({
  lang: z.string().optional(),
});

export const zodSearchTimelineUserId = z
  .string()
  .regex(/^\d+$/, "Must be a whole number.")
  .openapi({ example: "1" });
