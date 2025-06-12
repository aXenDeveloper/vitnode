import { z } from '@hono/zod-openapi';
import { buildRoute } from '@vitnode/core/api/lib/route';
import { removeSpecialCharacters } from '@vitnode/core/lib/special-characters';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { CONFIG_PLUGIN } from '@/config';
import { blog_categories } from '@/database/categories';

export const zodEditCategorySchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters long')
    .max(100, 'Title must not exceed 100 characters'),
});

const zodCategoryResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const editCategoryRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: 'put',
    path: '/{id}',
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
      body: {
        content: {
          'application/json': {
            schema: zodEditCategorySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: zodCategoryResponseSchema,
          },
        },
        description: 'Category updated successfully',
      },
      400: {
        description: 'Bad request - Invalid input data',
      },
      404: {
        description: 'Category not found',
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid('param');
    const { title } = c.req.valid('json');
    const titleSeo = removeSpecialCharacters(title);
    const [editData] = await c
      .get('db')
      .select({
        titleSeo: blog_categories.titleSeo,
      })
      .from(blog_categories)
      .where(eq(blog_categories.id, id))
      .limit(1);

    if (!editData) {
      throw new HTTPException(404);
    }

    const [titleSEODuplocate] = await c
      .get('db')
      .select({
        titleSeo: blog_categories.titleSeo,
      })
      .from(blog_categories)
      .where(eq(blog_categories.titleSeo, titleSeo))
      .limit(1);

    if (
      titleSEODuplocate?.titleSeo === titleSeo &&
      titleSEODuplocate.titleSeo !== editData.titleSeo
    ) {
      throw new HTTPException(400, {
        message: 'Category with this title already exists.',
      });
    }

    const [category] = await c
      .get('db')
      .update(blog_categories)
      .set({
        title,
        titleSeo: removeSpecialCharacters(title),
      })
      .where(eq(blog_categories.id, id))
      .returning();

    return c.json(category);
  },
});
