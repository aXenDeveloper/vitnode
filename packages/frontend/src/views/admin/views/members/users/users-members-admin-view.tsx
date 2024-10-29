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
import { ColumnsSortDirectionEnum } from 'vitnode-shared/admin/members/users.enum';

import { CreateUserUsersMembersAdmin } from '../create/create';
import { TableUsersMembersAdmin } from './table';

interface SearchParams extends SearchParamsPagination {
  groups?: string[];
}

export interface UsersMembersAdminViewProps {
  searchParams: Promise<SearchParams>;
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
  const { groups } = await searchParams;
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
    columnsSortByEnum: ColumnsSortDirectionEnum,
  });

  const query: UsersMembersAdminQuery = {
    ...variables,
    groups: Array.isArray(groups) ? groups.map(group => Number(group)) : [],
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
