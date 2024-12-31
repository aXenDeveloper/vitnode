import { fetcher } from '@/api/fetcher';
import { TranslationsProvider } from '@/components/translations-provider';
import { HeaderContent } from '@/components/ui/header-content';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ShowCronAdvancedAdminObj } from 'vitnode-shared/admin/advanced/cron.dto';

import { ContentCronAdvancedCoreAdmin } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowCronAdvancedAdminObj>({
    url: '/admin/advanced/cron',
  });

  return data;
};

export const generateMetadataCronAdvancedCoreAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.advanced.cron');

    return {
      title: t('title'),
    };
  };

export const CronAdvancedCoreAdminView = async () => {
  const [t, data] = await Promise.all([
    getTranslations('admin.core.advanced.cron'),
    getData(),
  ]);

  return (
    <TranslationsProvider namespaces="admin.core.advanced.cron">
      <HeaderContent desc={t('desc')} h1={t('title')} />

      <ContentCronAdvancedCoreAdmin {...data} />
    </TranslationsProvider>
  );
};
