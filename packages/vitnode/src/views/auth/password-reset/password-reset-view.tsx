import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { I18nProvider } from '@/components/i18n-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';

import { PasswordResetForm } from './form/form';

export const PasswordResetView = async () => {
  const [{ isEmail }, t] = await Promise.all([
    getMiddlewareApi(),
    getTranslations('core.auth.password_reset'),
  ]);
  if (!isEmail) notFound();

  return (
    <I18nProvider
      namespaces={['core.auth.sign_in', 'core.auth.password_reset']}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>
              <h1>{t('title')}</h1>
            </CardTitle>
            <CardDescription>{t('desc')}</CardDescription>
          </CardHeader>

          <CardContent>
            <PasswordResetForm />
          </CardContent>
        </Card>
      </div>
    </I18nProvider>
  );
};
