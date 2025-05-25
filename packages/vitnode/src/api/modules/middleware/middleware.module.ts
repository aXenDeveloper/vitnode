import { buildModule } from '@/api/lib/module';

import { routeMiddleware } from './route';
import { routeTestMiddleware } from './test';

export const middlewareModule = buildModule({
  plugin: 'vitnode',
  name: 'middleware',
  routes: [routeMiddleware, routeTestMiddleware],
});
