import { buildModule } from '@vitnode/core/api/lib/module';

import { CONFIG_PLUGIN } from '@/config';

import { createCategoryRoute } from './routes/create.route';
import { deleteCategoryRoute } from './routes/delete.route';
import { editCategoryRoute } from './routes/edit.route';
import { categoriesRoute } from './routes/get.route';

export const categoriesModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'categories',
  routes: [
    categoriesRoute,
    createCategoryRoute,
    editCategoryRoute,
    deleteCategoryRoute,
  ],
});
