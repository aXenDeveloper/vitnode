import { buildApiPlugin } from '@vitnode/core/api/lib/plugin';

import { categoriesModule } from './api/modules/categories/categories.module';
import { configPlugin } from './config';

export const blogApiPlugin = () => {
  return buildApiPlugin({
    ...configPlugin,
    modules: [categoriesModule],
  });
};
