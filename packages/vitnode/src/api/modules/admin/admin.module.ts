import { buildModule } from '@/api/lib/module';
import { CONFIG_PLUGIN } from '@/config';

import { sessionAdminRoute } from './routes/session.route';
import { usersAdminModule } from './users/users.admin.module';

export const adminModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'admin',
  routes: [sessionAdminRoute],
  modules: [usersAdminModule],
});
