'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useResetPassword } from './hooks/use-reset-password';

export const ResetPassword = () => {
  const t = useTranslations('core.sign_in.forgot_password.change_password');
  const tSignUp = useTranslations('core.sign_up');
  const { formSchema } = useResetPassword();

  return (
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
      submitButton={props => <Button {...props}>{t('title')}</Button>}
    />
  );
};
