import { buildApiPlugin } from './lib/plugin';
import { adminModule } from './modules/admin/admin.module';
import { middlewareModule } from './modules/middleware/middleware.module';
import { usersModule } from './modules/users/users.module';

export const newBuildPluginApiCore = buildApiPlugin({
  name: 'core',
  modules: [middlewareModule, usersModule, adminModule],
});
