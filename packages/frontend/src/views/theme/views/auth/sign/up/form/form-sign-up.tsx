'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { removeSpecialCharacters } from '@/helpers/special-characters';
import { useSignUpView } from '@/hooks/sign/up/use-sign-up-view';
import { Link } from '@/navigation';
import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const FormSignUp = () => {
  const t = useTranslations('core.sign_up');
  const { formSchema, onSubmit } = useSignUpView();

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          component: props => (
            <AutoFormInput {...props} className="bg-card shadow-sm" />
          ),
          label: t('name.label'),
          description: t('name.desc'),
          wrapper: ({ field, children }) => {
            const value: string = field.value ?? '';

            return (
              <>
                {children}
                {value.length > 0 && (
                  <span className="text-muted-foreground block max-w-md truncate text-sm">
                    {t.rich('name.your_id', {
                      id: () => (
                        <span className="text-foreground font-medium">
                          {removeSpecialCharacters(value)}
                        </span>
                      ),
                    })}
                  </span>
                )}
              </>
            );
          },
        },
        {
          id: 'email',
          component: props => (
            <AutoFormInput
              {...props}
              className="bg-card shadow-sm"
              type="email"
            />
          ),
          label: t('email.label'),
        },
        {
          id: 'password',
          label: t('password.label'),
          description: t('password.desc'),
          component: props => (
            <AutoFormInput
              {...props}
              className="bg-card shadow-sm"
              type="password"
            />
          ),
          wrapper: ({ field, children }) => {
            const value: string = field.value ?? '';
            const regexArray = [
              /^.{8,}$/, // Min 8 characters
              /[a-z]/, // Min 1 lowercase
              /[A-Z]/, // Min 1 uppercase
              /\d/, // Min 1 digit
              /\W|_/, // Min 1 special character
            ];

            const passRegexPassword = regexArray.reduce((acc, regex) => {
              return acc + Number(regex.test(value));
            }, 0);

            return (
              <>
                {children}
                {value.length > 0 && (
                  <div>
                    <div className="mb-2 flex justify-between text-xs font-semibold">
                      <span>{t('week_password')}</span>
                      <span>{t('strong_password')}</span>
                    </div>
                    <Progress
                      value={(100 / regexArray.length) * passRegexPassword}
                    />
                  </div>
                )}
              </>
            );
          },
        },
        {
          id: 'terms',
          label: t('terms.label'),
          className: 'bg-card',
          description: t.rich('terms.desc', {
            link: text => (
              <Link href="/legal" target="_blank">
                {text}
              </Link>
            ),
          }),
          component: AutoFormCheckbox,
        },
        {
          id: 'newsletter',
          className: 'bg-card',
          label: t('newsletter.label'),
          description: t('newsletter.desc'),
          component: AutoFormCheckbox,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <Button {...props} className="w-full">
          <LogIn />
          {t('submit')}
        </Button>
      )}
    >
      <div id="vitnode_captcha" />
    </AutoForm>
  );
};
