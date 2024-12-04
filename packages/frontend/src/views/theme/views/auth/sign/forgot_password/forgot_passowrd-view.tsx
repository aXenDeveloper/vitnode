import { TranslationsProvider } from '@/components/translations-provider';
import { CardDescription } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

import { FormForgotPassword } from './form';
import { ResetPassword } from './reset/reset-password';

export const ForgotPasswordView = async ({
  userId,
  token,
}: {
  token: string | undefined;
  userId: string | undefined;
}) => {
  const t = await getTranslations('core.sign_in.forgot_password');

  if (userId && token) {
    return (
      <TranslationsProvider
        namespaces={[
          'core.sign_in.forgot_password.change_password',
          'core.sign_up',
        ]}
      >
        <div className="container my-6 max-w-md py-10">
          <div className="mb-10 space-y-2 text-center">
            <h1 className="text-3xl font-semibold leading-none tracking-tight">
              {t('change_password.title')}
            </h1>
            <CardDescription>{t('change_password.desc')}</CardDescription>
          </div>

          <ResetPassword />
        </div>
      </TranslationsProvider>
    );
  }

  return (
    <TranslationsProvider namespaces="core.sign_in.forgot_password">
      <div className="container my-6 max-w-md py-10">
        <div className="mb-10 space-y-2 text-center">
          <h1 className="text-3xl font-semibold leading-none tracking-tight">
            {t('title')}
          </h1>
          <CardDescription>{t('desc')}</CardDescription>
        </div>

        <FormForgotPassword />
      </div>
    </TranslationsProvider>
  );
};
