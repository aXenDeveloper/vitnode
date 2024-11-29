import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

export const MetadataSettingsAdminView = async () => {
  const t = await getTranslations('admin.core.settings.metadata');

  return (
    <>
      <HeaderContent desc={t('desc')} h1={t('title')} />

      <Card className="p-6">test</Card>
    </>
  );
};
