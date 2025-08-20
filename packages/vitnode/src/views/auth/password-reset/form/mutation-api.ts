'use server';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';

export const mutationApi = async (email: string) => {
  const res = await fetcher(usersModule, {
    module: 'users',
    path: '/reset-password',
    method: 'post',
    args: {
      body: { email },
    },
  });

  if (res.status !== 201) {
    return { error: 'internal_server_error' };
  }
};
