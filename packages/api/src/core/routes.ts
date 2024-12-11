import { OpenAPIHono } from '@hono/zod-openapi';
import { middleware } from './middleware/routes.js';

export const core = new OpenAPIHono();
core.route('/middleware', middleware);
