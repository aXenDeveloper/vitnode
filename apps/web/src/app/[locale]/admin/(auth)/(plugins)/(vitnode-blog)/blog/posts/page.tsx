import type { Metadata } from 'next';

import { I18nProvider } from '@vitnode/core/components/i18n-provider';
import { DataTableSkeleton } from '@vitnode/core/components/table/data-table';
import { HeaderContent } from '@vitnode/core/components/ui/header-content';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { ActionsPostsAdmin } from '@vitnode/blog/views/admin/posts/actions/actions';

const PostsAdminView = React.lazy(async () =>
  import('@vitnode/blog/views/admin/posts/posts-admin-view').then(mod => ({
    default: mod.PostsAdminView,
  })),
);

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('@vitnode/blog.admin.nav');

  return {
    title: t('posts'),
  };
};

export default async function PostsPage(
  params: React.ComponentProps<typeof PostsAdminView>,
) {
  const [t, tNav] = await Promise.all([
    getTranslations('@vitnode/blog.admin.posts'),
    getTranslations('@vitnode/blog.admin.nav'),
  ]);

  return (
    <I18nProvider namespaces={['@vitnode/blog.admin.posts']}>
      <div className="p-4">
        <HeaderContent desc={t('desc')} h1={tNav('posts')}>
          <ActionsPostsAdmin />
        </HeaderContent>

        <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
          <PostsAdminView {...params} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
