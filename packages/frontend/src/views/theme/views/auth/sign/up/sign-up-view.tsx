import { getMiddlewareData } from '@/api/get-middleware-data';
import { CardDescription } from '@/components/ui/card';
import { Link } from '@/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { SSOSign } from '../sso';
import { FormSignUp } from './form';
import { SignUpWrapper } from './wrapper';

export const generateMetadataSignUp = async (): Promise<Metadata> => {
  const t = await getTranslations('core.sign_up');

  return {
    title: t('title'),
  };
};

export const SignUpView = async () => {
  const [
    t,
    {
      is_email_enabled,
      authorization: { lock_register },
      auth_methods,
    },
  ] = await Promise.all([getTranslations('core.sign_up'), getMiddlewareData()]);

  if (lock_register) {
    return notFound();
  }

  return (
    <SignUpWrapper isEmailEnabled={is_email_enabled}>
      <div className="container mx-auto max-w-md py-10">
        <div className="mb-10 space-y-2 text-center">
          <h1 className="text-3xl font-semibold leading-none tracking-tight">
            {t('title')}
          </h1>
          <CardDescription>
            {t.rich('desc', {
              link: () => <Link href="/login">{t('sign_in')}</Link>,
            })}
          </CardDescription>
        </div>

        {auth_methods.sso.length > 0 && <SSOSign />}
        <FormSignUp />
      </div>
    </SignUpWrapper>
  );
};
