import { buildPlugin } from '../lib/plugin';
import { adminModule } from './modules/admin/admin.module';
import { middlewareModule } from './modules/middleware/middleware.module';
import { usersModule } from './modules/users/users.module';

export const newBuildPluginCore = buildPlugin({
  name: 'core',
  modules: [middlewareModule, usersModule, adminModule],
});
