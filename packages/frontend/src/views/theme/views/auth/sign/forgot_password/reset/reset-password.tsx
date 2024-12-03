import { AutoForm } from '@/components/form/auto-form';
import { AutoFormTooltip } from '@/components/form/fields/common/tooltip';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useResetPassword } from './hooks/use-reset-password';

export const ResetPassword = () => {
  const t = useTranslations('core.sign_in.forgot_password');
  const tSignUp = useTranslations('core.sign_up');
  const { formSchema } = useResetPassword();

  return (
    <AutoForm
      fields={[
        {
          id: 'pin',
          label: t('pin.label'),
          description: t('pin.desc'),
          component: ({ field, ...rest }) => {
            return (
              <div className="flex flex-col items-center justify-center gap-2">
                <InputOTP maxLength={6} {...field}>
                  <InputOTPGroup>
                    <InputOTPSlot className="bg-card" index={0} />
                    <InputOTPSlot className="bg-card" index={1} />
                    <InputOTPSlot className="bg-card" index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot className="bg-card" index={3} />
                    <InputOTPSlot className="bg-card" index={4} />
                    <InputOTPSlot className="bg-card" index={5} />
                  </InputOTPGroup>
                </InputOTP>

                <AutoFormTooltip {...rest} />
              </div>
            );
          },
        },
        {
          id: 'password',
          label: tSignUp('password.label'),
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
      submitButton={props => (
        <>
          <Button {...props}>{t('change_password')}</Button>
        </>
      )}
    />
  );
};
