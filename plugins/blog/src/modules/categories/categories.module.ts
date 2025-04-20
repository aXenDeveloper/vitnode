import { OpenAPIHono } from '@hono/zod-openapi';

import { categoriesRoute } from './route';

export const categoriesModule = new OpenAPIHono()
  .route('/categories', categoriesRoute)
  .route('/test', categoriesRoute);

export type CategoriesTypes = typeof categoriesModule;
