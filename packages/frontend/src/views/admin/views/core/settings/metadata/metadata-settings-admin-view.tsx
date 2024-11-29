import { fetcher } from '@/api/fetcher';
import { TranslationsProvider } from '@/components/translations-provider';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';
import { ShowMetadataAdminObj } from 'vitnode-shared/admin/settings/metadata.dto';

import { ContentMetadataSettingsAdmin } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowMetadataAdminObj>({
    url: '/admin/settings/metadata',
    cache: 'force-cache',
  });

  return data;
};

export const MetadataSettingsAdminView = async () => {
  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.metadata'),
    getData(),
  ]);

  return (
    <TranslationsProvider namespaces="admin.core.settings.metadata">
      <HeaderContent desc={t('desc')} h1={t('title')} />
      <Card className="p-6">
        <ContentMetadataSettingsAdmin {...data} />
      </Card>
    </TranslationsProvider>
  );
};
