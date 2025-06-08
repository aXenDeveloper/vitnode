import { buildModule } from '@/api/lib/module';
import { CONFIG_PLUGIN } from '@/config';

import { listUsersAdminRoute } from './routes/list.route';

export const usersAdminModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'users',
  routes: [listUsersAdminRoute],
});
