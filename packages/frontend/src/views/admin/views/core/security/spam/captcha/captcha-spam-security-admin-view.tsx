import { fetcher } from '@/api/fetcher';
import { TranslationsProvider } from '@/components/translations-provider';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import { ContentCaptchaSpamSecurityAdmin } from './content';

const getData = async () => {
  const { data } = await fetcher<ShowCaptchaSecurityAdminObj>({
    url: '/admin/security/captcha',
    cache: 'force-cache',
  });

  return data;
};

export const generateMetadataCaptchaSpamSecurityAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.security.spam.captcha');

    return {
      title: t('title'),
    };
  };

export const CaptchaSpamSecurityAdminView = async () => {
  const data = await getData();

  return (
    <TranslationsProvider namespaces="admin.core.security.spam.captcha">
      <ContentCaptchaSpamSecurityAdmin {...data} />
    </TranslationsProvider>
  );
};
