import type { Metadata } from 'next/dist/types';

import { getTranslations } from 'next-intl/server';

import { SignUpView } from '../../views/auth/sign-up/sign-up-view';

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'core.global' });

  return {
    title: t('register'),
  };
};

export default function Page() {
  return <SignUpView />;
}
