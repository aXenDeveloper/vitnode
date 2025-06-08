import { buildModule } from '@/api/lib/module';

import { routeMiddleware } from './route';

export const middlewareModule = buildModule({
  plugin: '@vitnode/core',
  name: 'middleware',
  routes: [routeMiddleware],
});
