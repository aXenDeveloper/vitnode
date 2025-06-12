import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { CONFIG_PLUGIN } from '@/config';
import { blog_posts } from '@/database/posts';

export const deletePostRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'delete',
    path: '/{id}',
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
    },
    responses: {
      204: {
        description: 'Post deleted successfully',
      },
      404: {
        description: 'Post not found',
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid('param');

    const result = await c
      .get('db')
      .delete(blog_posts)
      .where(eq(blog_posts.id, id))
      .returning();

    if (result.length === 0) {
      throw new HTTPException(404);
    }

    return c.body(null, 204);
  },
});
