import { buildModule } from 'vitnode/api/lib/module';

import { categoriesRoute } from './route';

export const categoriesModule = buildModule({
  plugin: 'vitnode-blog',
  name: 'categories',
  routes: [categoriesRoute],
});
