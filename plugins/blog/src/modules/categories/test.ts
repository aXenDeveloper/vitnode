import { fetcher } from 'vitnode/lib/test';

import { CategoriesTypes } from './categories.module';

export const test = async () => {
  const client = fetcher<CategoriesTypes>();
  const response = await client.categories.$get();

  return response;
};
