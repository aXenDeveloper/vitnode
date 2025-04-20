import { createModuleApi } from '@/api/lib/module';
import { test } from '@/test/module';
import { OpenAPIHono } from '@hono/zod-openapi';

import { middlewareRoute } from './route';

export const middlewareModule = createModuleApi({
  name: 'middleware',
  plugin: 'core',
  routes: new OpenAPIHono()
    .route('/', middlewareRoute)
    .route('/testNew', test.hono),
});

export type MiddlewareTypes = typeof middlewareModule;
