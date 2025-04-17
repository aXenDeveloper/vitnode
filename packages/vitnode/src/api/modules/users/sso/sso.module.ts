import { createModuleApi } from '@/api/lib/module';
import { OpenAPIHono } from '@hono/zod-openapi';

import { callbackRoute } from './routes/callback.route';
import { createUrlRoute } from './routes/create-url.route';

export const ssoUserModule = createModuleApi({
  name: 'sso',
  plugin: 'core',
  routes: new OpenAPIHono()
    .route('/', createUrlRoute)
    .route('/', callbackRoute),
});
