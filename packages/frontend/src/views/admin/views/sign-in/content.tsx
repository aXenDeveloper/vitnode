'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSignInAdminView } from '@/views/theme/views/auth/sign/in/hooks/use-sign-in-admin-view';
import { AlertCircle, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const ContentSignInAdmin = () => {
  const t = useTranslations('core.sign_in');
  const { error, onSubmit, formSchema } = useSignInAdminView();

  return (
    <>
      {error === 'ACCESS_DENIED' && (
        <Alert className="mb-6" variant="error">
          <AlertCircle className="size-4" />
          <AlertTitle>{t('error.title')}</AlertTitle>
          <AlertDescription>{t('error.desc')}</AlertDescription>
        </Alert>
      )}

      <AutoForm
        fields={[
          {
            id: 'email',
            hideOptionalLabel: true,
            component: props => (
              <AutoFormInput
                {...props}
                className="bg-card shadow-sm"
                type="email"
              />
            ),
            label: t('email'),
          },
          {
            id: 'password',
            hideOptionalLabel: true,
            component: props => (
              <AutoFormInput
                {...props}
                className="bg-card shadow-sm"
                type="password"
              />
            ),
            label: t('password'),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButton={props => (
          <Button className="w-full" {...props}>
            <LogIn /> {t('submit')}
          </Button>
        )}
      />
    </>
  );
};
