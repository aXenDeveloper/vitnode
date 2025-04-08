import { createPluginApi } from './lib/plugin';
import { adminModule } from './modules/admin/admin.module';
import { middlewareModule } from './modules/middleware/middleware.module';
import { usersModule } from './modules/users/users.module';

export default createPluginApi({
  name: 'core',
  modules: [usersModule, middlewareModule, adminModule],
});
