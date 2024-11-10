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
  ShowFilesAdvancedAdminObj,
  ShowFilesAdvancedAdminQuery,
} from 'vitnode-shared/admin/advanced/files.dto';

import { ContentFilesAdvancedCoreAdminView } from './content';

const getData = async (query: ShowFilesAdvancedAdminQuery) => {
  const { data } = await fetcher<
    ShowFilesAdvancedAdminObj,
    ShowFilesAdvancedAdminQuery
  >({
    url: '/admin/advanced/files',
    query,
  });

  return data;
};

export const generateMetadataFilesAdvancedCoreAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.advanced.files');

    return {
      title: t('title'),
    };
  };

export const FilesAdvancedCoreAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });

  const [t, data] = await Promise.all([
    getTranslations('admin.core.advanced.files'),
    getData(variables),
  ]);

  return (
    <TranslationsProvider
      namespaces={['admin.core.advanced.files', 'core.settings.files']}
    >
      <HeaderContent h1={t('title')} />

      <ContentFilesAdvancedCoreAdminView {...data} />
    </TranslationsProvider>
  );
};
