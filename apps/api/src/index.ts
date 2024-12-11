import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { plugins } from '@/plugins/plugins.js';
import { honoConfig } from 'vitnode-api/index';

const app = new OpenAPIHono();

app.route('/', plugins);

honoConfig({ app });

const port = 8081;
const hostname = 'localhost';
const initConsole = '\x1b[34m[VitNode]\x1b[0m';
console.log(initConsole, `API is running on: http://${hostname}:${port}/`);

serve({
  fetch: app.fetch,
  port,
});
