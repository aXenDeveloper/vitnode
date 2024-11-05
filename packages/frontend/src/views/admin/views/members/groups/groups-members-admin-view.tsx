import { fetcher } from '@/api/fetcher';
import { TranslationsProvider } from '@/components/translations-provider';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  GroupsMembersAdminObj,
  GroupsMembersAdminQuery,
} from 'vitnode-shared/admin/members/groups.dto';
import { GroupsMembersAdminSortEnum } from 'vitnode-shared/admin/members/groups.enum';

import { ActionsGroupsMembersAdmin } from './actions/actions-groups-members-admin';
import { TableGroupsMembersAdmin } from './table/table';

const getData = async (query: GroupsMembersAdminQuery) => {
  const { data } = await fetcher<
    GroupsMembersAdminObj,
    GroupsMembersAdminQuery
  >({
    url: '/admin/members/groups',
    query,
  });

  return data;
};

export interface GroupsMembersAdminViewProps {
  searchParams: Promise<SearchParamsPagination>;
}

export const generateMetadataGroupsMembersAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.members.groups');

    return {
      title: t('title'),
    };
  };

export const GroupsMembersAdminView = async ({
  searchParams,
}: GroupsMembersAdminViewProps) => {
  const variables = await getPaginationTool({
    searchParams,
    sortEnum: GroupsMembersAdminSortEnum,
  });

  const [data, t] = await Promise.all([
    getData(variables),
    getTranslations('admin.members.groups'),
  ]);

  return (
    <TranslationsProvider namespaces="admin.members.groups">
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <ActionsGroupsMembersAdmin />
      </HeaderContent>

      <TableGroupsMembersAdmin {...data} />
    </TranslationsProvider>
  );
};
