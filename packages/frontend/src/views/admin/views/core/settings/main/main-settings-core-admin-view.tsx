import { getMiddlewareData } from '@/api/get-middleware-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
// import {
//   checkAdminPermissionPage,
//   checkAdminPermissionPageMetadata,
// } from '@/graphql/get-session-admin-data';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ContentMainSettingsCoreAdmin } from './content';

// import { ContentMainSettingsCoreAdmin } from './content';

// const getData = async () => {
//   const data = await fetcher<
//     Core_Main_Settings__ShowQuery,
//     Core_Main_Settings__ShowQueryVariables
//   >({
//     query: Core_Main_Settings__Show,
//     cache: 'force-cache',
//   });

//   return data;
// };

const permission = {
  plugin_code: 'core',
  group: 'settings',
  permission: 'can_manage_settings_main',
};

export const generateMetadataMainSettingsCoreAdmin =
  async (): Promise<Metadata> => {
    // const perm = await checkAdminPermissionPageMetadata(permission);
    // if (perm) return perm;
    const t = await getTranslations('admin.core.settings.main');

    return {
      title: t('title'),
    };
  };

export const MainSettingsCoreAdminView = async () => {
  // const perm = await checkAdminPermissionPage(permission);
  // if (perm) return perm;
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
