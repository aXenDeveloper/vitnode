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
  ShowLanguagesAdminObj,
  ShowLanguagesAdminQuery,
} from 'vitnode-shared/admin/language.dto';

import { CreateActionLangAdmin } from './actions/create';
import { ContentLangsCoreAdminView } from './table/content';

const getData = async (query: ShowLanguagesAdminQuery) => {
  const { data } = await fetcher<
    ShowLanguagesAdminObj,
    ShowLanguagesAdminQuery
  >({
    url: '/admin/core/languages',
    query,
    cache: 'force-cache',
  });

  return data;
};

export const generateMetadataLangsCoreAdmin = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.core.langs');

  return {
    title: t('title'),
  };
};

export const LangsCoreAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });

  const [t, data] = await Promise.all([
    getTranslations('admin.core.langs'),
    getData(variables),
  ]);

  return (
    <TranslationsProvider namespaces={['admin.core.langs']}>
      <HeaderContent h1={t('title')}>
        <CreateActionLangAdmin />
      </HeaderContent>

      <ContentLangsCoreAdminView {...data} />
    </TranslationsProvider>
  );
};
