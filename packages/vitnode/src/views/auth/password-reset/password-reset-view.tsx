import { notFound } from 'next/navigation';

import { I18nProvider } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';

import { PasswordResetForm } from './form/form';
import { ChangePasswordForm } from './change-password-form/change-password-form';

export const PasswordResetView = async ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; userId: string }>;
}) => {
  const [{ isEmail }, { token, userId }] = await Promise.all([
    getMiddlewareApi(),
    searchParams,
  ]);
  if (!isEmail) notFound();

  return (
    <I18nProvider
      namespaces={['core.auth.sign_in', 'core.auth.reset_password']}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
        <Card>
          {token && userId ? (
            <ChangePasswordForm token={token} userId={userId} />
          ) : (
            <PasswordResetForm />
          )}
        </Card>
      </div>
    </I18nProvider>
  );
};
