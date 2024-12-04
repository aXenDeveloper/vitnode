'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { Link } from '@/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useForgotPasswordView } from './hooks/use-forgot-password-view';
import { SuccessForgotPassword } from './success';

export const FormForgotPassword = () => {
  const t = useTranslations('core.sign_in.forgot_password');
  const { formSchema, email, onSubmit } = useForgotPasswordView();

  if (email) {
    return <SuccessForgotPassword email={email} />;
  }

  return (
    <>
      <div className="mb-10 space-y-2 text-center">
        <h1 className="text-3xl font-semibold leading-none tracking-tight">
          {t('title')}
        </h1>
        <CardDescription>{t('desc')}</CardDescription>
      </div>

      <AutoForm
        fields={[
          {
            id: 'email',
            label: t('email'),
            component: props => (
              <AutoFormInput className="bg-card" {...props} type="email" />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButton={props => (
          <>
            <Button asChild className="flex-1" variant="ghost">
              <Link href="/login">
                <ChevronLeftIcon /> {t('go_back_login')}
              </Link>
            </Button>
            <Button className="flex-1" {...props}>
              {t('send')}
            </Button>
          </>
        )}
      >
        <div id="vitnode_captcha" />
      </AutoForm>
    </>
  );
};
