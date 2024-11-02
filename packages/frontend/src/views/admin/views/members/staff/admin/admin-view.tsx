import { fetcher } from '@/api/fetcher';
import { getMiddlewareData } from '@/api/get-middleware-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  AdminStaffMembersAdminObj,
  AdminStaffMembersAdminQuery,
} from 'vitnode-shared/admin/members/staff/admin.dto';

import { ActionsAdministratorsStaffAdmin } from './actions/actions';
import { TableAdministratorsStaffAdmin } from './table/table';

const getData = async (query: AdminStaffMembersAdminQuery) => {
  const { data } = await fetcher<
    AdminStaffMembersAdminObj,
    AdminStaffMembersAdminQuery
  >({
    url: '/admin/members/staff/admin',
    query,
  });

  return data;
};

export const generateMetadataAdminStaffAdmin = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.members.staff.admin');

  return {
    title: t('title'),
  };
};

export const AdminStaffAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });

  const [t, middleware, data] = await Promise.all([
    getTranslations('admin.members.staff.admin'),
    getMiddlewareData(),
    getData(variables),
  ]);

  return (
    <TranslationsProvider
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      namespaces={[
        'admin.members.staff.admin',
        'admin.members.staff.shared',
        'admin_core.admin_permissions',
        'admin_members.admin_permissions',
        ...middleware.plugins.map(
          plugin => `admin_${plugin}.admin_permissions`,
        ),
      ]}
    >
      <HeaderContent h1={t('title')}>
        <ActionsAdministratorsStaffAdmin permissions={data.permissions} />
      </HeaderContent>

      <TableAdministratorsStaffAdmin {...data} />
    </TranslationsProvider>
  );
};
