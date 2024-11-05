import { fetcher } from '@/api/fetcher';
import { checkAdminPermissionPage } from '@/api/get-session-admin-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { HeaderContent } from '@/components/ui/header-content';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import React from 'react';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { CreateActionNavAdmin } from './actions/create';
import { TableNavAdmin } from './table/table';

const getData = async () => {
  const { data } = await fetcher<ShowNavStyles[]>({
    url: '/admin/styles/nav',
    cache: 'force-cache',
  });

  return data;
};

export const generateMetadataNavAdmin = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.core.styles.nav');

  return {
    title: t('title'),
  };
};

export const NavAdminView = async () => {
  const perm = await checkAdminPermissionPage({
    plugin_code: 'core',
    group: 'styles',
    permission: 'can_manage_styles_nav',
  });
  if (perm) return perm;
  const [edges, t] = await Promise.all([
    getData(),
    getTranslations('admin.core.styles.nav'),
  ]);

  return (
    <TranslationsProvider namespaces="admin.core.styles.nav">
      <HeaderContent h1={t('title')}>
        <CreateActionNavAdmin />
      </HeaderContent>

      <TableNavAdmin edges={edges} />
    </TranslationsProvider>
  );
};
