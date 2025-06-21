import { getTranslations } from 'next-intl/server';

import { I18nProvider } from '@/components/i18n-provider';
import { HeaderContent } from '@/components/ui/header-content';
import { ClearCacheAction } from '@/views/admin/views/core/debug/actions/clear-cache/clear-cache';
import { DebugAdminView } from '@/views/admin/views/core/debug/debug-admin-view';

export const generateMetadata = async () => {
  const t = await getTranslations('admin.debug');

  return {
    title: t('title'),
    description: t('desc'),
  };
};

export default async function Page() {
  const t = await getTranslations('admin.debug');

  return (
    <I18nProvider namespaces="admin.debug">
      <div className="p-4">
        <HeaderContent desc={t('desc')} h1={t('title')}>
          <ClearCacheAction />
        </HeaderContent>

        <DebugAdminView />
      </div>
    </I18nProvider>
  );
}
