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
  ShowLanguagesAdminObj,
  ShowLanguagesAdminQuery,
} from 'vitnode-shared/admin/language.dto';
import { ShowLanguagesAdminSortEnum } from 'vitnode-shared/admin/language.enum';

import { CreateActionLangAdmin } from './actions/create';
import { ContentLangsCoreAdminView } from './table/content';

const getData = async (query: ShowLanguagesAdminQuery) => {
  const { data } = await fetcher<
    ShowLanguagesAdminObj,
    ShowLanguagesAdminQuery
  >({
    url: '/admin/languages',
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
    sortEnum: ShowLanguagesAdminSortEnum,
  });

  const [t, data, middleware] = await Promise.all([
    getTranslations('admin.core.langs'),
    getData(variables),
    getMiddlewareData(),
  ]);

  return (
    <TranslationsProvider
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      namespaces={[
        'admin.core.langs',
        ...middleware.plugins.map(plugin => `admin_${plugin}.nav.title`),
      ]}
    >
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <CreateActionLangAdmin />
      </HeaderContent>

      <ContentLangsCoreAdminView {...data} />
    </TranslationsProvider>
  );
};
