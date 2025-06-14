'use client';

import { useTranslations } from 'next-intl';

import type { ItemAutoFormComponentProps } from '@/components/form/fields/item';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormInput } from '@/components/form/fields/input';
import { Link } from '@/lib/navigation';
import { removeSpecialCharacters } from '@/lib/special-characters';

import { PasswordInput } from '../../components/password-input';
import { useFormSignUp } from './use-form';

export const FormSignUp = ({ isEmail }: { isEmail: boolean }) => {
  const t = useTranslations('core.auth.sign_up');
  const { onSubmit, formSchema } = useFormSignUp();

  return (
    <AutoForm<typeof formSchema>
      fields={[
        {
          id: 'name',
          component: ({ field, shape }) => {
            const value = (field.value ?? '') as string;

            return (
              <div className="space-y-2">
                <AutoFormInput
                  field={field}
                  label={t('username.label')}
                  shape={shape}
                />
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
              </div>
            );
          },
        },
        {
          id: 'email',
          component: props => (
            <AutoFormInput label={t('email.label')} type="email" {...props} />
          ),
        },
        {
          id: 'password',
          component: ({ field }) => <PasswordInput {...field} />,
        },
        {
          id: 'terms',
          component: props => (
            <AutoFormCheckbox
              description={t.rich('terms.desc', {
                link: text => (
                  <Link className="text-primary" href="/terms">
                    {text}
                  </Link>
                ),
              })}
              label={t('terms.label')}
              {...props}
            />
          ),
        },
        ...(isEmail
          ? [
              {
                id: 'newsletter' as const,
                component: (
                  props: ItemAutoFormComponentProps<typeof formSchema>,
                ) => (
                  <AutoFormCheckbox
                    description={t('newsletter.desc')}
                    label={t('newsletter.label')}
                    {...props}
                  />
                ),
              },
            ]
          : []),
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        className: 'w-full',
        children: t('submit'),
      }}
    />
  );
};
