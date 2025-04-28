import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';

export const getSessionApi = async () => {
  const res = await fetcher(usersModule, {
    path: '/session',
    method: 'get',
    module: 'users',
    options: {
      cache: 'force-cache',
    },
  });

  return await res.json();
};

export type SessionApi = Awaited<ReturnType<typeof getSessionApi>>;
