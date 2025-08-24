import type { Metadata } from 'next/dist/types';

import { getTranslations } from 'next-intl/server';

import { PasswordResetView } from '@/views/auth/password-reset/password-reset-view';

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'core.auth.reset_password',
  });

  return {
    title: t('title'),
  };
};

export default function Page(
  props: React.ComponentProps<typeof PasswordResetView>,
) {
  return <PasswordResetView {...props} />;
}
