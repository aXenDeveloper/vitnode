import { notFound } from 'next/navigation';

import { I18nProvider } from '@/components/i18n-provider';
import { Card } from '@/components/ui/card';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';

import { ChangePasswordForm } from './change-password-form/form';
import { PasswordResetForm } from './form/form';

export const PasswordResetView = async ({
  searchParams,
}: {
  searchParams: Promise<{ token: string; userId: string }>;
}) => {
  const [{ isEmail, captcha }, { token, userId }] = await Promise.all([
    getMiddlewareApi(),
    searchParams,
  ]);
  if (!isEmail) notFound();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
      <Card>
        {token && userId ? (
          <I18nProvider
            namespaces={['core.auth.sign_up', 'core.auth.change_password']}
          >
            <ChangePasswordForm token={token} userId={userId} />
          </I18nProvider>
        ) : (
          <I18nProvider
            namespaces={['core.auth.sign_up', 'core.auth.reset_password']}
          >
            <PasswordResetForm captcha={captcha} />
          </I18nProvider>
        )}
      </Card>
    </div>
  );
};
