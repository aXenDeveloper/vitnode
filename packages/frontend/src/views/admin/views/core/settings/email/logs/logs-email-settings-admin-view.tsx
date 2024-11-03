import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  LogsEmailSettingsAdminObj,
  LogsEmailSettingsAdminQuery,
} from 'vitnode-shared/admin/settings/email.dto';

import { ContentLogsEmailSettingsAdmin } from './content';

const getData = async (query: LogsEmailSettingsAdminQuery) => {
  const { data } = await fetcher<
    LogsEmailSettingsAdminObj,
    LogsEmailSettingsAdminQuery
  >({
    url: '/admin/settings/email/logs',
    query,
  });

  return data;
};

export const generateMetadataLogsEmailSettingsAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.settings.email.logs');

    return {
      title: t('title'),
    };
  };

export const LogsEmailSettingsAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });

  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.email.logs'),
    getData(variables),
  ]);

  return (
    <>
      <HeaderContent h1={t('title')} />
      <ContentLogsEmailSettingsAdmin {...data} />
    </>
  );
};
