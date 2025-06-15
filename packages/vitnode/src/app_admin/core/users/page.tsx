import type { Metadata } from 'next/dist/types';

import { getTranslations } from 'next-intl/server';
import React from 'react';

import { DataTableSkeleton } from '@/components/table/data-table';
import { HeaderContent } from '@/components/ui/header-content';
import { UsersAdminView } from '@/views/admin/views/core/users/users-admin-view';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.global.nav.users');

  return {
    title: t('list'),
  };
};

export default async function Page(
  props: React.ComponentProps<typeof UsersAdminView>,
) {
  const [t, tNav] = await Promise.all([
    getTranslations('admin.user.list'),
    getTranslations('admin.global.nav.users'),
  ]);

  return (
    <div className="p-4">
      <HeaderContent desc={t('desc')} h1={tNav('list')} />

      <React.Suspense fallback={<DataTableSkeleton columns={2} />}>
        <UsersAdminView {...props} />
      </React.Suspense>
    </div>
  );
}
