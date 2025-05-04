import { middlewareModule } from '@/api/modules/middleware/middleware.module';
import { fetcher } from '@/lib/fetcher';

export const getMiddlewareApi = async () => {
  const res = await fetcher(middlewareModule, {
    path: '/',
    method: 'get',
    module: 'middleware',
    options: {
      cache: 'force-cache',
    },
  });

  return await res.json();
};
