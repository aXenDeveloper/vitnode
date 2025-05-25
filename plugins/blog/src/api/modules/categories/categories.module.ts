import { buildModule } from '@vitnode/core/api/lib/module';

import { categoriesRoute } from './route';

export const categoriesModule = buildModule({
  plugin: '@vitnode/blog',
  name: 'categories',
  routes: [categoriesRoute],
});
