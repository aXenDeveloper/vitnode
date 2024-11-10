import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { fetcher } from './fetcher';

export const getMiddlewareData = async () => {
  const { data } = await fetcher<ShowMiddlewareObj>({
    url: '/core/middleware',
    cache: 'force-cache',
  });

  return data;
};
