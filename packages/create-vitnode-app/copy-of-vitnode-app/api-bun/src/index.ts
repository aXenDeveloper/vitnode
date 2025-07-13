import { OpenAPIHono } from '@hono/zod-openapi';
import { VitNodeAPI } from '@vitnode/core/api/config';

import { vitNodeApiConfig } from './vitnode.api.config.js';

const app = new OpenAPIHono().basePath('/api');

VitNodeAPI({
  app,
  vitNodeApiConfig,
});

export default {
  port: 8080,
  fetch: app.fetch,
};
