import type { Metadata } from 'next/dist/types';

import { getTranslations } from 'next-intl/server';

import { SignInView } from '@vitnode/core/views/auth/sign-in/sign-in-view';

export const generateMetadata = async ({
  locale,
}: {
  locale: string;
}): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: 'core.global' });

  return {
    title: t('login'),
  };
};

export default function Page() {
  return <SignInView />;
}
