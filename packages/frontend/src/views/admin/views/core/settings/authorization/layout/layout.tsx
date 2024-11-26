import { TranslationsProvider } from '@/components/translations-provider';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

import { TabsLayoutAuthorizationSettingsAdmin } from './tabs';

export const LayoutAuthorizationSettingsAdmin = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [t] = await Promise.all([
    getTranslations('admin.core.settings.authorization'),
  ]);

  return (
    <TranslationsProvider
      namespaces={['admin.core.settings.authorization', 'admin.global']}
    >
      <HeaderContent desc={t('desc')} h1={t('title')} />
      <TabsLayoutAuthorizationSettingsAdmin />

      {children}
    </TranslationsProvider>
  );
};
