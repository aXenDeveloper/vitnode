import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { CONTENT_ID_PATTERN } from "@/content/const";
import { contentSearchHiddenAccess } from "@/content/server/hidden-access";
import {
  listContentProfileTypes,
  readContentProfilePage,
} from "@/content/server/profile-content";
import { core_users } from "@/database/users";
import { findOpenAccountDeletion } from "@/lib/account-deletion/requests";
import { reactionImageSchema } from "@/lib/reactions/catalog";
import { REACTION_KINDS } from "@/lib/reactions/const";
import { readReactionTimeline } from "@/lib/reactions/timeline";
import { searchTimeline } from "@/modules/search/lib/timeline";
import {
  zodSearchHitAuthor,
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

/** A record the member authored, in `kind=content` mode - only what a card renders. */
const authoredEdgeSchema = z.object({
  createdAt: z.date(),
  item: z.object({
    authors: z.array(zodSearchHitAuthor),
    content: z.string(),
    createdAt: z.date(),
    image: z
      .object({
        height: z.number().optional(),
        url: z.string(),
        width: z.number().optional(),
      })
      .nullable(),
    itemId: z.union([z.number().int(), z.string().max(64)]),
    itemType: z.string(),
    languageCode: z.string(),
    metadata: z.record(z.string(), z.unknown()),
    pluginId: z.string(),
    title: z.string(),
    url: z.string().nullable(),
  }),
  kind: z.literal("authored"),
});

/**
 * A `kind=content` cursor: where the page ended, bound to the member and the
 * filter it was minted for, so it cannot be replayed against another list.
 */
const contentCursorSchema = z.object({
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/),
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/),
  m: z.literal("content"),
  t: z.string().max(64).nullable(),
  ty: z.string().regex(CONTENT_ID_PATTERN),
  u: z.number().int(),
});

type ContentCursor = z.infer<typeof contentCursorSchema>;

const decodeContentCursor = (raw: string): ContentCursor | null => {
  try {
    const parsed = contentCursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The validator's own `400`, for a query value only the handler can judge. */
const invalidQuery = (field: string, message: string, input: unknown) => ({
  error: new z.ZodError([{ code: "custom", input, message, path: [field] }]),
  success: false as const,
});

export const userTimelineRoute = buildRoute({
  route: {
    method: "get",
    description:
      "A member's activity, newest first: the content they wrote and the reactions they gave (unless they hide them). Reactions appear only on targets the visitor can read. With `kind=content`, only what they authored, as a guest sees it, optionally narrowed to one content type with `type`",
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
        /** `content`: only what the member authored, with its own cursor. */
        kind: z.enum(["activity", "content"]).optional(),
        lang: z.string().max(32).optional(),
        /** With `kind=content`: one content type listed on profiles, e.g. `forum.comment`. */
        type: z
          .string()
          .max(64)
          .regex(CONTENT_ID_PATTERN)
          .optional()
          .openapi({ example: "forum.comment" }),
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
                  authoredEdgeSchema,
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
      400: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.object({ message: z.string(), name: z.string() }),
              success: z.literal(false),
            }),
          },
        },
        description:
          "An unsupported `type`, `type` without `kind=content`, or a cursor minted for another list",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "User not found (`kind=content` only)",
      },
    },
  },
  handler: async c => {
    const userId = Number(c.req.valid("param").userId);
    const query = c.req.valid("query");
    const first = query.first ?? PAGE_DEFAULT;

    if (query.kind === "content") {
      const type = query.type ?? null;
      if (
        type !== null &&
        !listContentProfileTypes(c).some(entry => entry.id === type)
      ) {
        return c.json(
          invalidQuery(
            "type",
            "Not a content type listed on profiles in this app.",
            type,
          ),
          400,
        );
      }

      const after = query.cursor ? decodeContentCursor(query.cursor) : null;
      if (
        query.cursor &&
        (after === null || after.u !== userId || after.t !== type)
      ) {
        return c.json(
          invalidQuery(
            "cursor",
            "Not a cursor of this member's content list with this filter.",
            query.cursor,
          ),
          400,
        );
      }

      const [member] = await c
        .get("db")
        .select({ id: core_users.id })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .limit(1);
      if (
        !member ||
        (c.get("user")?.id !== userId &&
          (await findOpenAccountDeletion(c, userId)))
      ) {
        return c.json({ error: "User not found" }, 404);
      }

      const page = await readContentProfilePage(c, {
        after: after
          ? { at: after.at, id: after.id, type: after.ty }
          : undefined,
        first,
        locale: query.lang,
        type: type ?? undefined,
        userId,
      });

      return c.json(
        {
          edges: page.cards.map(item => ({
            createdAt: item.createdAt,
            item,
            kind: "authored" as const,
          })),
          pageInfo: {
            endCursor: page.endCursor
              ? Buffer.from(
                  JSON.stringify({
                    at: page.endCursor.at,
                    id: page.endCursor.id,
                    m: "content",
                    t: type,
                    ty: page.endCursor.type,
                    u: userId,
                  } satisfies ContentCursor),
                ).toString("base64url")
              : null,
            hasNextPage: page.hasNextPage,
          },
        },
        200,
      );
    }

    if (query.type !== undefined) {
      return c.json(
        invalidQuery("type", "`type` filters `kind=content` only.", query.type),
        400,
      );
    }

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
      cursor.rd
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
