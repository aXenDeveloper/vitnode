'use server';

import {
  GroupsMembersAdminObj,
  GroupsMembersAdminQuery,
} from 'vitnode-shared/admin/members/groups.dto';

import { fetcher } from './fetcher';

export const getGroupsShortApi = async (query: GroupsMembersAdminQuery) => {
  const { data } = await fetcher<
    GroupsMembersAdminObj,
    GroupsMembersAdminQuery
  >({
    url: '/admin/members/groups',
    query,
  });

  return data;
};
