import { fetcher } from 'vitnode/test/elo';

import { categoriesModule } from './categories.module';

export const test = () => {
  fetcher(categoriesModule, {
    module: 'categories',
    path: '/',
    method: 'get',
    args: {
      query: {
        test: 'test',
      },
    },
  });
};
