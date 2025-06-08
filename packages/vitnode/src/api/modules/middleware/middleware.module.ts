import { buildModule } from '@/api/lib/module';
import { CONFIG_PLUGIN } from '@/config';

import { routeMiddleware } from './route';

export const middlewareModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'middleware',
  routes: [routeMiddleware],
});
