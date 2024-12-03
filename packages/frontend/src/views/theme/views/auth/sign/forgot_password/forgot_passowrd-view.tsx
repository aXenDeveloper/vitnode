import { TranslationsProvider } from '@/components/translations-provider';
import { CardDescription } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

import { FormForgotPassword } from './form';

export const ForgotPasswordView = async () => {
  const t = await getTranslations('core.sign_in.forgot_password');

  return (
    <TranslationsProvider
      namespaces={['core.sign_in.forgot_password', 'core.sign_up']}
    >
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
