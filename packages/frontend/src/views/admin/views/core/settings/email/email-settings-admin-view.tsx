import { fetcher } from '@/api/fetcher';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ShowEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

import { ActionsEmailSettingsAdmin } from './actions/actions';
import { ContentEmailSettingsAdmin } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowEmailSettingsAdminObj>({
    url: '/admin/settings/email',
    cache: 'force-cache',
  });

  return data;
};

export const generateMetadataEmailSettingsAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin_core.nav');

    return {
      title: t('settings_email'),
    };
  };

export const EmailSettingsAdminView = async () => {
  const [t, data] = await Promise.all([
    getTranslations('admin.core.settings.email'),
    getData(),
  ]);

  return (
    <>
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <ActionsEmailSettingsAdmin disabled={!data.is_enabled} />
      </HeaderContent>

      <Card className="p-6">
        <ContentEmailSettingsAdmin {...data} />
      </Card>
    </>
  );
};
