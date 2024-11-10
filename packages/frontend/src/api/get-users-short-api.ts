'use server';

import {
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';

import { fetcher } from './fetcher';

export const getUsersShortApi = async (query: UsersMembersAdminQuery) => {
  const { data } = await fetcher<UsersMembersAdminObj, UsersMembersAdminQuery>({
    url: '/admin/members/users',
    query,
  });

  return data;
};
