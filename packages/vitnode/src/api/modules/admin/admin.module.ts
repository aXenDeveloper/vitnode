import { createModuleApi } from '@/api/lib/module';
import { OpenAPIHono } from '@hono/zod-openapi';

import { sessionAdminRoute } from './routes/session.route';

export const adminModule = createModuleApi({
  name: 'admin',
  plugin: 'core',
  routes: new OpenAPIHono().route('/session', sessionAdminRoute),
});

export type AdminTypes = typeof adminModule;
