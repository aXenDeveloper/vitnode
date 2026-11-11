import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

import type { SearchHiddenAccess } from "@/api/models/search";

import type { zodSearchTimelineQuery } from "../search.schema";

import { positiveIntOrUndefined } from "./query-params";

export const searchTimeline = async (
  c: Context,
  {
    authorId,
    hiddenAccess,
    includePrivate,
    query,
    skipAccess,
  }: {
    authorId: number;
    hiddenAccess?: SearchHiddenAccess;
    includePrivate: boolean;
    query: z.infer<typeof zodSearchTimelineQuery>;
    /** Only for staff routes - see `SearchQueryParams.skipAccess`. */
    skipAccess?: boolean;
  },
) =>
  await c.get("search").search({
    authorId,
    cursor: query.cursor,
    first: positiveIntOrUndefined(query.first),
    hiddenAccess,
    includePrivate,
    languageCode: query.lang,
    skipAccess,
    sort: "newest",
  });
