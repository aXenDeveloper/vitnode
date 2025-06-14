import type { Metadata } from 'next';

import { I18nProvider } from '@vitnode/core/components/i18n-provider';
import { HeaderContent } from '@vitnode/core/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

import { PostsAdminView } from '@/views/admin/posts/posts-admin-view';

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
      <div className="container mx-auto p-4">
        <HeaderContent desc={t('desc')} h1={tNav('posts')} />

        <PostsAdminView {...params} />
      </div>
    </I18nProvider>
  );
}
