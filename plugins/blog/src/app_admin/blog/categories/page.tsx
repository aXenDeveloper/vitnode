import { I18nProvider } from '@vitnode/core/components/i18n-provider';
import { DataTableSkeleton } from '@vitnode/core/components/table/data-table';
import { HeaderContent } from '@vitnode/core/components/ui/header-content';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { ActionsCategoriesAdmin } from '@/views/admin/categories/actions/actions';

const CategoriesAdminView = dynamic(async () =>
  import('@/views/admin/categories/table/categories-admin-view').then(mod => ({
    default: mod.CategoriesAdminView,
  })),
);

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('@vitnode/blog.admin.nav');

  return {
    title: t('categories'),
  };
};

export default async function CategoriesPage(
  params: React.ComponentProps<typeof CategoriesAdminView>,
) {
  const [t, tNav] = await Promise.all([
    getTranslations('@vitnode/blog.admin.categories'),
    getTranslations('@vitnode/blog.admin.nav'),
  ]);

  return (
    <I18nProvider namespaces={['@vitnode/blog.admin.categories']}>
      <div className="p-4">
        <HeaderContent desc={t('desc')} h1={tNav('categories')}>
          <ActionsCategoriesAdmin />
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={4} />}>
          <CategoriesAdminView {...params} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
