import { buildModule } from '@/api/lib/module';

import { callbackRoute } from './routes/callback.route';
import { createUrlRoute } from './routes/create-url.route';
import { testModule } from './test/test.module';

export const ssoUserModule = buildModule({
  name: 'sso',
  plugin: 'core',
  routes: [callbackRoute, createUrlRoute],
  modules: [testModule],
});
