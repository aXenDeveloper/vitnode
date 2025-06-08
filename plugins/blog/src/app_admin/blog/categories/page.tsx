import type { Metadata } from 'next';

import { HeaderContent } from '@vitnode/core/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('@vitnode/blog.admin.nav');

  return {
    title: t('categories'),
  };
};

export default async function CategoriesPage() {
  const [t, tNav] = await Promise.all([
    getTranslations('@vitnode/blog.admin.categories'),
    getTranslations('@vitnode/blog.admin.nav'),
  ]);

  return (
    <div className="container mx-auto p-4">
      <HeaderContent desc={t('desc')} h1={tNav('categories')} />
    </div>
  );
}
