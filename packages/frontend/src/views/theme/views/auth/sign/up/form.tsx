'use client';

import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { removeSpecialCharacters } from '@/helpers/special-characters';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { Link } from '@/navigation';
import { CircleCheck, CircleX, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useSignUpView } from './hooks/use-sign-up-view';

export const FormSignUp = () => {
  const t = useTranslations('core.sign_up');
  const { formSchema, onSubmit } = useSignUpView();
  const { is_email_enabled } = useMiddlewareData();

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'newsletter',
          type: DependencyType.HIDES,
          targetField: 'newsletter',
          when: () => !is_email_enabled,
        },
      ]}
      fields={[
        {
          id: 'name',
          component: props => {
            const value: string = props.field.value ?? '';

            return (
              <>
                <AutoFormInput {...props} className="bg-card shadow-sm" />
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
          label: t('name.label'),
          description: t('name.desc'),
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
                    {t('password.desc')}
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

                        <span>{t(`password.${id}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
