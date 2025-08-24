import { SignUpView } from '@vitnode/core/views/auth/sign-up/sign-up-view';
import type { Metadata } from 'next/dist/types';
import { getTranslations } from 'next-intl/server';

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
