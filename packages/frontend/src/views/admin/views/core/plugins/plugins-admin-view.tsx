import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  ShowPluginsAdminObj,
  ShowPluginsAdminQuery,
} from 'vitnode-shared/admin/plugins.dto';

import { WarnReqRestartServer } from '../warn-req-restart-server';
import { ActionsPluginsAdmin } from './actions/actions';
import { ContentPluginsCoreAdmin } from './table/content';

const getData = async (query: ShowPluginsAdminQuery) => {
  const { data } = await fetcher<ShowPluginsAdminObj, ShowPluginsAdminQuery>({
    url: '/admin/plugins',
    query,
  });

  return data;
};

export const generateMetadataPluginsAdmin = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.core.plugins');

  return {
    title: t('title'),
  };
};

export const PluginsAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });
  const [t, data] = await Promise.all([
    getTranslations('admin.core.plugins'),
    getData(variables),
  ]);

  return (
    <>
      <HeaderContent h1={t('title')}>
        <ActionsPluginsAdmin />
      </HeaderContent>

      <WarnReqRestartServer />
      <ContentPluginsCoreAdmin {...data} />
    </>
  );
};
