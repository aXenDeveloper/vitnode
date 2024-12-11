import { core } from 'vitnode-api/core/index';
import { OpenAPIHono } from '@hono/zod-openapi';

export const plugins = new OpenAPIHono();

plugins.route('/core', core);
