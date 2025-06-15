import type { Metadata } from 'next';

import { I18nProvider } from '@vitnode/core/components/i18n-provider';
import { HeaderContent } from '@vitnode/core/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

import { CategoriesAdminView } from '@/views/admin/categories/categories-admin-view';

import { ActionsCategoriesAdmin } from '../../../views/admin/categories/actions/actions';

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

        <CategoriesAdminView {...params} />
      </div>
    </I18nProvider>
  );
}
