import { buildModule } from '@/api/lib/module';

import { callbackRoute } from './routes/callback.route';
import { createUrlRoute } from './routes/create-url.route';

export const ssoUserModule = buildModule({
  name: 'sso',
  plugin: 'vitnode',
  routes: [callbackRoute, createUrlRoute],
});
