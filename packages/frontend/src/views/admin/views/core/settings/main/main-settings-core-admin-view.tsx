import { getMiddlewareData } from '@/api/get-middleware-data';
import { checkAdminPermissionPage } from '@/api/get-session-admin-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ContentMainSettingsCoreAdmin } from './content';

const permission = {
  plugin_code: 'core',
  group: 'settings',
  permission: 'can_manage_settings_main',
};

export const generateMetadataMainSettingsCoreAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.settings.main');

    return {
      title: t('title'),
    };
  };

export const MainSettingsCoreAdminView = async () => {
  const perm = await checkAdminPermissionPage(permission);
  if (perm) return perm;
  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.main'),
    getMiddlewareData(),
  ]);

  return (
    <TranslationsProvider namespaces="admin.core.settings.main">
      <HeaderContent desc={t('desc')} h1={t('title')} />

      <Card className="p-6">
        <ContentMainSettingsCoreAdmin {...data} />
      </Card>
    </TranslationsProvider>
  );
};
