import { buildModule } from '@/api/lib/module';

import { sessionAdminRoute } from './routes/session.route';
import { usersAdminModule } from './users/users.admin.module';

export const adminModule = buildModule({
  name: 'admin',
  plugin: '@vitnode/core',
  routes: [sessionAdminRoute],
  modules: [usersAdminModule],
});
