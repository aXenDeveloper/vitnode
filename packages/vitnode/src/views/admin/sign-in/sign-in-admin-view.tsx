import { I18nProvider } from '@/components/i18n-provider';
import { LogoVitNode } from '@/components/logo-vitnode';
import { Card } from '@/components/ui/card';
import { FormSignIn } from '@/views/auth/sign-in/form/form';

export const SignInAdminView = () => {
  return (
    <I18nProvider namespaces={['core.auth.sign_in']}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-10 px-4 py-16">
        <LogoVitNode className="w-64" />
        <Card className="w-full p-6">
          <FormSignIn isAdmin />
        </Card>
      </div>
    </I18nProvider>
  );
};
