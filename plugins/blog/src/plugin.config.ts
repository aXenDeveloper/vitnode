import { buildApiPlugin } from 'vitnode/api/lib/plugin';

import { categoriesModule } from './modules/categories/categories.module';

export const blogApiPlugin = () => {
  return buildApiPlugin({
    name: 'blog',
    modules: [categoriesModule],
  });
};
