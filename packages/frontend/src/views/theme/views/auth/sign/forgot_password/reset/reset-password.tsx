'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ForgotPasswordView } from '../forgot_password-view';
import { useResetPassword } from './hooks/use-reset-password';
import { SuccessResetPassword } from './success';

export const ResetPassword = (
  props: React.ComponentProps<typeof ForgotPasswordView>,
) => {
  const t = useTranslations('core.sign_in.forgot_password.change_password');
  const tSignUp = useTranslations('core.sign_up');
  const { formSchema, onSubmit, isSuccess } = useResetPassword(props);

  if (isSuccess) {
    return <SuccessResetPassword />;
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
            id: 'password',
            label: t('new_password'),
            component: props => {
              const value: string = props.field.value ?? '';
              const regexArray = [
                {
                  regex: /^.{8,}$/.test(value),
                  id: 'min_length' as const,
                },
                {
                  regex: /[A-Z]/.test(value),
                  id: 'uppercase' as const,
                },
                {
                  regex: /\d/.test(value),
                  id: 'number' as const,
                },
                {
                  regex: /\W|_/.test(value),
                  id: 'special_char' as const,
                },
              ];

              return (
                <>
                  <AutoFormInput
                    {...props}
                    className="bg-card shadow-sm"
                    type="password"
                  />
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {tSignUp('password.desc')}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {regexArray.map(({ regex, id }, index) => (
                        <li
                          className="text-muted-foreground flex flex-wrap gap-2"
                          key={index}
                        >
                          {regex ? (
                            <CircleCheck className="text-primary size-5" />
                          ) : (
                            <CircleX className="text-destructive size-5" />
                          )}

                          <span>{tSignUp(`password.${id}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              );
            },
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButton={props => <Button {...props}>{t('title')}</Button>}
      />
    </>
  );
};
