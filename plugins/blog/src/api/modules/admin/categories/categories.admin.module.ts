import { buildModule } from '@vitnode/core/api/lib/module';

import { CONFIG_PLUGIN } from '../../../../const';
import { createCategoryRoute } from './routes/create.route';
import { deleteCategoryRoute } from './routes/delete.route';
import { editCategoryRoute } from './routes/edit.route';

export const categoriesAdminModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'categories',
  routes: [createCategoryRoute, editCategoryRoute, deleteCategoryRoute],
});
