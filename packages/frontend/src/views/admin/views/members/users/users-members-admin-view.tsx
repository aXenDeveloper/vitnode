import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';
import { UsersMembersAdminSortEnum } from 'vitnode-shared/admin/members/users.enum';

import { CreateUserUsersMembersAdmin } from '../create/create';
import { TableUsersMembersAdmin } from './table';

export interface UsersMembersAdminViewProps {
  searchParams: Promise<SearchParams>;
}

interface SearchParams extends SearchParamsPagination {
  group_id?: string | string[];
}

const getData = async (query: UsersMembersAdminQuery) => {
  const { data } = await fetcher<UsersMembersAdminObj, UsersMembersAdminQuery>({
    url: '/admin/members/users',
    query,
  });

  return data;
};

export const generateMetadataUsersMembersAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.members.users');

    return {
      title: t('title'),
    };
  };

export const UsersMembersAdminView = async ({
  searchParams,
}: UsersMembersAdminViewProps) => {
  const { group_id } = await searchParams;
  const variables = await getPaginationTool({
    searchParams,
    sortEnum: UsersMembersAdminSortEnum,
  });

  const query: UsersMembersAdminQuery = {
    ...variables,
    groups: Array.isArray(group_id)
      ? group_id.map(group => +group)
      : group_id
        ? [+group_id]
        : [],
  };

  const [t, data] = await Promise.all([
    getTranslations('admin.members.users'),
    getData(query),
  ]);

  return (
    <>
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <CreateUserUsersMembersAdmin />
      </HeaderContent>

      <TableUsersMembersAdmin {...data} />
    </>
  );
};
