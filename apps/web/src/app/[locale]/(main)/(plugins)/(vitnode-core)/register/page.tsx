import type { Metadata } from 'next/dist/types';

import { SignUpView } from '@vitnode/core/views/auth/sign-up/sign-up-view';
import { getTranslations } from 'next-intl/server';

export const generateMetadata = async ({
  locale,
}: {
  locale: string;
}): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: 'core.global' });

  return {
    title: t('register'),
  };
};

export default function Page() {
  return <SignUpView />;
}
