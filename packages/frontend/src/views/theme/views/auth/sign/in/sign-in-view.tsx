import { CardDescription, CardTitle } from '@/components/ui/card';
import { Link } from '@/navigation';
import { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { FormSignIn } from './form/form-sign-in';

export const generateMetadataSignIn = async (): Promise<Metadata> => {
  const t = await getTranslations('core.sign_in');

  return {
    title: t('title'),
  };
};

export const SignInView = () => {
  const t = useTranslations('core.sign_in');

  return (
    <div className="container mx-auto max-w-md pt-10">
      <div className="mb-10 space-y-1 text-center">
        <CardTitle className="text-3xl">{t('title')}</CardTitle>
        <CardDescription>
          {t.rich('desc', {
            link: () => <Link href="/register">{t('sign_up')}</Link>,
          })}
        </CardDescription>
      </div>

      <FormSignIn />
    </div>
  );
};
