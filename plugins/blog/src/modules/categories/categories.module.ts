import { OpenAPIHono } from '@hono/zod-openapi';

import { listCategories } from './routes/list.route';

export const categoriesModule = new OpenAPIHono().route('/', listCategories);
