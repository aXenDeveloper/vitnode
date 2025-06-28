import { buildModule } from '@vitnode/core/api/lib/module';

import { CONFIG_PLUGIN } from '../../../const';
import { categoriesAdminModule } from './categories/categories.admin.module';
import { postsAdminModule } from './posts/posts.admin.module';

export const adminModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'admin',
  modules: [categoriesAdminModule, postsAdminModule],
  routes: [],
});
