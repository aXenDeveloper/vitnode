'use server';

import { fetcher } from '@/api/fetcher';
import {
  SearchNavAuthAdminObj,
  SearchNavAuthAdminQuery,
} from 'vitnode-shared/admin/auth.dto';

export const queryApi = async (query: SearchNavAuthAdminQuery) => {
  const { data } = await fetcher<
    SearchNavAuthAdminObj,
    SearchNavAuthAdminQuery
  >({
    url: '/admin/auth/search',
    query,
  });

  return { data };
};
