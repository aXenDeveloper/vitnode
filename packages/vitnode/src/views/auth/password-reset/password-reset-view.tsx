import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { I18nProvider } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';

import { PasswordResetForm } from './form/form';

export const PasswordResetView = async () => {
  const [{ isEmail }, t] = await Promise.all([
    getMiddlewareApi(),
    getTranslations('core.auth.reset_password'),
  ]);
  if (!isEmail) notFound();

  return (
    <I18nProvider
      namespaces={['core.auth.sign_in', 'core.auth.reset_password']}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
        <Card>
          <PasswordResetForm />
        </Card>
      </div>
    </I18nProvider>
  );
};
