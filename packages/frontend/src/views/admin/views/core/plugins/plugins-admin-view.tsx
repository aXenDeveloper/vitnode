import { fetcher } from '@/api/fetcher';
import { getSessionAdminData } from '@/api/get-session-admin-data';
import { HeaderContent } from '@/components/ui/header-content';
import { CONFIG } from '@/helpers/config-with-env';
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
import { ShowPluginsAdminSortEnum } from 'vitnode-shared/admin/plugins.enum';

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
    sortEnum: ShowPluginsAdminSortEnum,
  });
  const [t, data, { user }] = await Promise.all([
    getTranslations('admin.core.plugins'),
    getData(variables),
    getSessionAdminData(),
  ]);

  return (
    <>
      <HeaderContent desc={t('desc')} h1={t('title')}>
        {CONFIG.node_development && <ActionsPluginsAdmin user={user} />}
      </HeaderContent>

      <WarnReqRestartServer />
      <ContentPluginsCoreAdmin {...data} />
    </>
  );
};
