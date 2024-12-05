import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import { redirect } from '@/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ShowDevicesSettingsAuthObj } from 'vitnode-shared/auth/settings/devices.dto';

import { ContentDevicesSettings } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowDevicesSettingsAuthObj[]>({
    url: '/core/auth/settings/devices',
    cache: 'force-cache',
  });

  return data;
};

export const generateMetadataDevicesSettings = async (): Promise<Metadata> => {
  const t = await getTranslations('core.settings.devices');

  return {
    title: t('title'),
    description: t('desc'),
  };
};

export const DevicesSettingsView = async () => {
  const [t, cookieStore, data] = await Promise.all([
    getTranslations('core.settings.devices'),
    cookies(),
    getData(),
  ]);
  const loginToken = cookieStore.get('vitnode-login-token')?.value;
  if (!loginToken) {
    await redirect('/login');

    return;
  }

  return (
    <div>
      <HeaderContent desc={t('desc')} h1={t('title')} />

      <ContentDevicesSettings data={data} loginToken={loginToken} />
    </div>
  );
};
