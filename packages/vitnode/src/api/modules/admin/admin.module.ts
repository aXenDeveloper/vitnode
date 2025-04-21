import { buildModule } from '@/api/lib/module';

import { sessionAdminRoute } from './routes/session.route';

export const adminModule = buildModule({
  name: 'admin',
  plugin: 'core',
  routes: [sessionAdminRoute],
});

export type AdminTypes = typeof adminModule;
