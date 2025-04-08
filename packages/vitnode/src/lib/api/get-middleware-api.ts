import { MiddlewareTypes } from '@/api/modules/middleware/middleware.module';

import { fetcher } from '../fetcher';

export const getMiddlewareApi = async () => {
  const client = await fetcher<MiddlewareTypes>({
    plugin: 'core',
    module: 'middleware',
    options: {
      cache: 'force-cache',
    },
  });

  const res = await client.index.$get();

  return await res.json();
};
