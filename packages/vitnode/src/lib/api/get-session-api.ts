import { UsersTypes } from '@/api/modules/users/users.module';

import { fetcher } from '../fetcher';

export const getSessionApi = async () => {
  const client = await fetcher<UsersTypes>({
    plugin: 'core',
    module: 'users',
    options: {
      cache: 'force-cache',
    },
  });

  const res = await client.session.$get();

  return await res.json();
};

export type SessionApi = Awaited<ReturnType<typeof getSessionApi>>;
