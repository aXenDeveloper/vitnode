import type { PublicPerson } from "@vitnode/core/api/lib/public-people";
import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  loadPublicPeople,
  zodPublicPerson,
} from "@vitnode/core/api/lib/public-people";
import {
  contentListPageCacheTags,
  rememberContentPublicRead,
} from "@vitnode/core/content/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { buildModule, buildRoute } from "@/api/builders";
import { publishedPostCondition } from "@/api/lib/public-posts";
import {
  blog_posts,
  blog_posts_author_id,
  postContent,
} from "@/database/posts";

const BLOG_AUTHORS_MAX_POSTS = 50;
const POST_IDS = new RegExp(
  `^[1-9]\\d{0,9}(,[1-9]\\d{0,9}){0,${BLOG_AUTHORS_MAX_POSTS - 1}}$`,
);

export const zodBlogPostAuthors = z.object({
  authors: z.array(zodPublicPerson),
  postId: z.number(),
});

const readPostAuthors = async (
  c: Context<EnvVitNode>,
  postIds: number[],
): Promise<{ authors: PublicPerson[]; postId: number }[]> => {
  const rows = await c
    .get("db")
    .select({
      postId: blog_posts_author_id.itemId,
      userId: blog_posts_author_id.relatedItemId,
    })
    .from(blog_posts_author_id)
    .innerJoin(blog_posts, eq(blog_posts_author_id.itemId, blog_posts.id))
    .where(
      and(
        inArray(blog_posts_author_id.itemId, postIds),
        publishedPostCondition(),
      ),
    )
    .orderBy(
      asc(blog_posts_author_id.itemId),
      asc(blog_posts_author_id.position),
    );

  const people = await loadPublicPeople(
    c,
    rows.map(row => Number(row.userId)),
  );
  const byPost = new Map<number, PublicPerson[]>();

  for (const row of rows) {
    const person = people.get(Number(row.userId));
    if (!person) continue;

    const postId = Number(row.postId);
    byPost.set(postId, [...(byPost.get(postId) ?? []), person]);
  }

  return [...byPost].map(([postId, authors]) => ({ authors, postId }));
};

const publicAuthorsRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description: `The authors of up to ${BLOG_AUTHORS_MAX_POSTS} published articles`,
    request: {
      query: z.object({
        posts: z.string().regex(POST_IDS).openapi({ example: "1,2,3" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodBlogPostAuthors) }),
          },
        },
        description: "Authors per published article that has any",
      },
      400: {
        description: `\`posts\` is not a list of up to ${BLOG_AUTHORS_MAX_POSTS} article ids`,
      },
    },
  },
  handler: async c => {
    const postIds = [
      ...new Set(c.req.valid("query").posts.split(",").map(Number)),
    ].sort((a, b) => a - b);

    const items = await rememberContentPublicRead(c, {
      contentTypeId: postContent.definition.id,
      key: { postIds, route: "@vitnode/blog:post-authors" },
      load: async () => await readPostAuthors(c, postIds),
    });

    setPageCacheTags(c, contentListPageCacheTags(postContent.definition));

    return c.json({ items }, 200);
  },
});

export const authorsModule = buildModule({
  name: "authors",
  routes: [publicAuthorsRoute],
});
