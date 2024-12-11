import { core } from 'vitnode-api/core/routes';
import { OpenAPIHono } from '@hono/zod-openapi';

export const plugins = new OpenAPIHono();

plugins.route('/core', core);
