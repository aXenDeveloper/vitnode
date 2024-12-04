import { TranslationsProvider } from '@/components/translations-provider';

import { FormForgotPassword } from './form';
import { ResetPassword } from './reset/reset-password';

export const ForgotPasswordView = ({
  userId,
  token,
}: {
  token: string | undefined;
  userId: string | undefined;
}) => {
  if (userId && token) {
    return (
      <TranslationsProvider
        namespaces={[
          'core.sign_in.forgot_password.change_password',
          'core.sign_up',
        ]}
      >
        <div className="container my-6 max-w-md py-10">
          <ResetPassword token={token} userId={userId} />
        </div>
      </TranslationsProvider>
    );
  }

  return (
    <TranslationsProvider namespaces="core.sign_in.forgot_password">
      <div className="container my-6 max-w-md py-10">
        <FormForgotPassword />
      </div>
    </TranslationsProvider>
  );
};
