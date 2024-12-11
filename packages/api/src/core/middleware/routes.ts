import { OpenAPIHono } from '@hono/zod-openapi';
import { show } from './services/show.js';

export const middleware = new OpenAPIHono();
middleware.route('/', show);
