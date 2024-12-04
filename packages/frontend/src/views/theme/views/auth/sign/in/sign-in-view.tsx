import { getMiddlewareData } from '@/api/get-middleware-data';
import { CardDescription } from '@/components/ui/card';
import { Link } from '@/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SSOSign } from '../sso';
import { FormSignIn } from './form';

export const generateMetadataSignIn = async (): Promise<Metadata> => {
  const t = await getTranslations('core.sign_in');

  return {
    title: t('title'),
  };
};

export const SignInView = async () => {
  const [
    t,
    {
      auth_methods,
      authorization: { lock_register },
      is_email_enabled,
    },
  ] = await Promise.all([getTranslations('core.sign_in'), getMiddlewareData()]);

  return (
    <div className="container mx-auto max-w-md py-10">
      <div className="mb-10 space-y-2 text-center">
        <h1 className="text-3xl font-semibold leading-none tracking-tight">
          {t('title')}
        </h1>
        {!lock_register && (
          <CardDescription>
            {t.rich('desc', {
              link: () => <Link href="/register">{t('sign_up')}</Link>,
            })}
          </CardDescription>
        )}
      </div>
      {auth_methods.sso.length > 0 && <SSOSign />}
      <FormSignIn />
      {is_email_enabled && (
        <div className="mt-4 flex items-center justify-end text-sm">
          <Link className="text-right" href="/login/forgot-password">
            {t('forgot_password.title')}
          </Link>
        </div>
      )}
    </div>
  );
};
