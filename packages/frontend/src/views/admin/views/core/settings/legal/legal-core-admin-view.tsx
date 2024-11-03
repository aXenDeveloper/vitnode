import { fetcher } from '@/api/fetcher';
import { checkAdminPermissionPage } from '@/api/get-session-admin-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Button } from '@/components/ui/button';
import { HeaderContent } from '@/components/ui/header-content';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import { Link } from '@/navigation';
import { SquareArrowOutUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';

import { CreateLegalSettingsAdmin } from './create';
import { TableLegalSettingsAdmin } from './table/table';

const getData = async (query: LegalsQuery) => {
  const { data } = await fetcher<LegalsObj, LegalsQuery>({
    url: '/core/legal',
    query,
    cache: 'force-cache',
  });

  return data;
};

const permission = {
  plugin_code: 'core',
  group: 'settings',
  permission: 'can_manage_settings_legal',
};

export const generateMetadataLegalSettingsAdmin = async () => {
  const t = await getTranslations('admin.core.settings.legal');

  return {
    title: t('title'),
  };
};

export const LegalSettingsAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const perm = await checkAdminPermissionPage(permission);
  if (perm) return perm;
  const variables = await getPaginationTool({
    searchParams,
    defaultPageSize: 10,
  });
  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.legal'),
    getData(variables),
  ]);

  return (
    <TranslationsProvider namespaces="admin.core.settings.legal">
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <Button asChild variant="ghost">
          <Link href="/legal" target="_blank">
            {t('legal_public')} <SquareArrowOutUpRight />
          </Link>
        </Button>
        <CreateLegalSettingsAdmin />
      </HeaderContent>

      <TableLegalSettingsAdmin {...data} />
    </TranslationsProvider>
  );
};
