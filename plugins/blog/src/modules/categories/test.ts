import { fetcher } from 'vitnode/lib/fetcher';

import { categoriesModule } from './categories.module';

export const test = async () => {
  await fetcher(categoriesModule, {
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
