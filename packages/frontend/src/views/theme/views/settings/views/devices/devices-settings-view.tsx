import { fetcher } from '@/api/fetcher';
import { CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { redirect } from '@/navigation';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
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
    <>
      <CardHeader>
        <h1 className="text-2xl font-semibold leading-none tracking-tight">
          {t('title')}
        </h1>
        <CardDescription>{t('desc')}</CardDescription>
      </CardHeader>

      <CardContent>
        <ContentDevicesSettings data={data} loginToken={loginToken} />
      </CardContent>
    </>
  );
};
