import { buildModule } from '@/api/lib/module';

import { listUsersAdminRoute } from './routes/list.route';

export const usersAdminModule = buildModule({
  name: 'users',
  plugin: 'vitnode',
  routes: [listUsersAdminRoute],
});
