'use server';

import { UsersTypes } from '@/api/modules/users/users.module';
import { fetcher, FetcherInput } from '@/lib/fetcher';

export const mutationApi = async (
  input: FetcherInput<UsersTypes, '/sign_up', 'post'>,
) => {
  const res = await fetcher<UsersTypes>({
    plugin: 'core',
    module: 'users',
  });
  const data = await res.sign_up.$post(input);

  if (data.status !== 200) {
    return { message: await data.text() };
  }
};
