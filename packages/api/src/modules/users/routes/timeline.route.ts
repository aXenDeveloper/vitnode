import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";
import { reactionImageSchema } from "@/lib/reactions/catalog";
import { REACTION_KINDS } from "@/lib/reactions/const";
import {
  canSeeReactionsOf,
  readReactionTimeline,
} from "@/lib/reactions/timeline";
import { searchTimeline } from "@/modules/search/lib/timeline";
import {
  zodSearchHitSchema,
  zodSearchTimelineUserId,
} from "@/modules/search/search.schema";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;

const cursorSchema = z.object({
  /** The last search hit shown, or `null` before the first. */
  s: z.number().int().nullable(),
  /** The last reaction entry shown, or `null` before the first. */
  r: z.number().int().nullable(),
  /** Search is exhausted. */
  sd: z.boolean(),
  /** Reactions are exhausted. */
  rd: z.boolean(),
});

type TimelineCursor = z.infer<typeof cursorSchema>;

const encodeCursor = (cursor: TimelineCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

const decodeCursor = (raw: string | undefined): TimelineCursor => {
  const start = { r: null, rd: false, s: null, sd: false };
  if (!raw) return start;
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );

    return parsed.success ? parsed.data : start;
  } catch {
    return start;
  }
};

const reactionEdgeSchema = z.object({
  createdAt: z.date(),
  kind: z.literal("reaction"),
  reaction: z.object({
    code: z.string(),
    icon: z.string().nullable(),
    image: reactionImageSchema.nullable(),
    kind: z.enum(REACTION_KINDS),
    title: z.array(z.object({ languageCode: z.string(), value: z.string() })),
  }),
  target: z.object({
    context: z
      .object({ title: z.string(), url: z.string().nullable() })
      .optional(),
    id: z.string(),
    label: z.string(),
    pluginId: z.string(),
    title: z.string(),
    type: z.string(),
    url: z.string(),
  }),
});

const contentEdgeSchema = z.object({
  createdAt: z.date(),
  item: zodSearchHitSchema,
  kind: z.literal("content"),
});

export const userTimelineRoute = buildRoute({
  route: {
    method: "get",
    description:
      "A member's activity, newest first: the content they wrote and the reactions they gave (unless they hide them). Reactions appear only on targets the visitor can read",
    path: "/{userId}/timeline",
    request: {
      params: z.object({ userId: zodSearchTimelineUserId }),
      query: z.object({
        cursor: z
          .string()
          .max(512)
          .regex(/^[A-Za-z0-9_-]+$/)
          .optional(),
        first: z.coerce.number().int().min(1).max(PAGE_MAX).optional(),
        lang: z.string().max(32).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.discriminatedUnion("kind", [
                  contentEdgeSchema,
                  reactionEdgeSchema,
                ]),
              ),
              pageInfo: z.object({
                endCursor: z.string().nullable(),
                hasNextPage: z.boolean(),
              }),
            }),
          },
        },
        description: "Timeline",
      },
    },
  },
  handler: async c => {
    const userId = Number(c.req.valid("param").userId);
    const query = c.req.valid("query");
    const first = query.first ?? PAGE_DEFAULT;
    const cursor = decodeCursor(query.cursor);

    const [search, reactions] = await Promise.all([
      cursor.sd
        ? null
        : searchTimeline(c, {
            authorId: userId,
            hiddenAccess: await contentSearchHiddenAccess(c),
            includePrivate: false,
            query: {
              first: String(first),
              lang: query.lang,
              ...(cursor.s === null ? {} : { cursor: String(cursor.s) }),
            },
          }),
      cursor.rd || !(await canSeeReactionsOf(c, userId))
        ? { done: true, items: [] }
        : readReactionTimeline(c, { before: cursor.r, first, userId }),
    ]);

    const merged = [
      ...(search?.edges ?? []).map(item => ({
        createdAt: item.createdAt,
        item,
        kind: "content" as const,
      })),
      ...reactions.items.map(item => ({
        createdAt: item.createdAt,
        entryId: item.entryId,
        kind: "reaction" as const,
        reaction: item.reaction,
        target: item.target,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, first);

    const lastContent = merged.findLast(edge => edge.kind === "content");
    const lastReaction = merged.findLast(edge => edge.kind === "reaction");
    const searchHasMore = search
      ? search.pageInfo.hasNextPage ||
        merged.filter(edge => edge.kind === "content").length <
          search.edges.length
      : false;
    const reactionsHaveMore =
      !reactions.done ||
      merged.filter(edge => edge.kind === "reaction").length <
        reactions.items.length;

    const next: TimelineCursor = {
      r: lastReaction?.kind === "reaction" ? lastReaction.entryId : cursor.r,
      rd: !reactionsHaveMore,
      s: lastContent?.kind === "content" ? lastContent.item.id : cursor.s,
      sd: !searchHasMore,
    };
    const hasNextPage = !next.rd || !next.sd;

    return c.json(
      {
        edges: merged.map(edge =>
          edge.kind === "content"
            ? edge
            : {
                createdAt: edge.createdAt,
                kind: edge.kind,
                reaction: edge.reaction,
                target: edge.target,
              },
        ),
        pageInfo: {
          endCursor: hasNextPage ? encodeCursor(next) : null,
          hasNextPage,
        },
      },
      200,
    );
  },
});
