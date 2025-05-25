import type { Metadata } from 'next/dist/types';

import { getTranslations } from 'next-intl/server';
import { SignUpView } from 'vitnode/views/auth/sign-up/sign-up-view';

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
