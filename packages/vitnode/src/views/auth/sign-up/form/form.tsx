'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormInput } from '@/components/form/fields/input';
import { Link } from '@/lib/navigation';
import { removeSpecialCharacters } from '@/lib/special-characters';
import { useTranslations } from 'next-intl';

import { PasswordInput } from '../../components/password-input';
import { useFormSignUp } from './hooks/use-form';

export const FormSignUp = ({ isEmail }: { isEmail: boolean }) => {
  const t = useTranslations('core.auth.sign_up');
  const { onSubmit, formSchema } = useFormSignUp();

  return (
    <AutoForm<typeof formSchema>
      fields={[
        {
          id: 'name',
          component: ({ field }) => {
            const value = (field.value ?? '') as string;

            return (
              <>
                <AutoFormInput field={field} label={t('username.label')} />
                {value.length >= 3 && (
                  <div className="text-muted-foreground text-sm">
                    {t.rich('username.your_user_code', {
                      code: () => (
                        <span className="text-foreground">
                          {removeSpecialCharacters(value)}
                        </span>
                      ),
                    })}
                  </div>
                )}
              </>
            );
          },
        },
        {
          id: 'email',
          component: ({ field }) => (
            <AutoFormInput
              field={field}
              label={t('email.label')}
              type="email"
            />
          ),
        },
        {
          id: 'password',
          component: ({ field }) => <PasswordInput {...field} />,
        },
        {
          id: 'terms',
          component: ({ field }) => (
            <AutoFormCheckbox
              description={t.rich('terms.desc', {
                link: text => (
                  <Link className="text-primary" href="/terms">
                    {text}
                  </Link>
                ),
              })}
              field={field}
              label={t('terms.label')}
            />
          ),
        },
        ...(isEmail
          ? [
              {
                id: 'newsletter' as const,
                component: ({ field }) => (
                  <AutoFormCheckbox
                    description={t('newsletter.desc')}
                    field={field}
                    label={t('newsletter.label')}
                  />
                ),
              },
            ]
          : []),
      ]}
      formSchema={formSchema}
      mode="onBlur"
      onSubmit={onSubmit}
      submitButtonProps={{
        className: 'w-full',
        children: t('submit'),
      }}
    />
  );
};
