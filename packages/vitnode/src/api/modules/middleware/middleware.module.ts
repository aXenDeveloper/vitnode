import { buildModule } from '@/api/lib/module';

import { routeMiddleware } from './route';

export type MiddlewareTypes = typeof middlewareModule;

export const middlewareModule = buildModule({
  plugin: 'core',
  name: 'middleware',
  routes: [routeMiddleware],
});

export type BuildMiddlewareTypes = typeof middlewareModule;
