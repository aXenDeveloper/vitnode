import { buildApiPlugin } from '@vitnode/core/api/lib/plugin';

import { CONFIG_PLUGIN } from '@/config';

import { categoriesModule } from './api/modules/categories/categories.module';
import { postsModule } from './api/modules/posts/posts.module';

export const blogApiPlugin = () => {
  return buildApiPlugin({
    ...CONFIG_PLUGIN,
    modules: [categoriesModule, postsModule],
  });
};
