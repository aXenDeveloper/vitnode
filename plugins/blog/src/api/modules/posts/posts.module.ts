import { buildModule } from '@vitnode/core/api/lib/module';

import { CONFIG_PLUGIN } from '@/const';

import { createPostRoute } from './routes/create.route';
import { deletePostRoute } from './routes/delete.route';
import { editPostRoute } from './routes/edit.route';
import { postsRoute } from './routes/get.route';

export const postsModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'posts',
  routes: [postsRoute, createPostRoute, editPostRoute, deletePostRoute],
});
