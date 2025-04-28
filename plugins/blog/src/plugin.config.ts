import { buildPlugin } from 'vitnode/lib/plugin';

import { categoriesModule } from './modules/categories/categories.module';

export const blogPlugin = () => {
  return buildPlugin({
    name: 'blog',
    modules: [categoriesModule],
  });
};
