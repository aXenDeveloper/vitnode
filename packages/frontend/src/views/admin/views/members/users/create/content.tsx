import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { removeSpecialCharacters } from '@/helpers/special-characters';
import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useCreateUserAdmin } from './hooks/use-create-user-admin';

export const ContentCreateUserUsersMembersAdmin = () => {
  const { formSchema, onSubmit } = useCreateUserAdmin();
  const t = useTranslations('core.sign_up');

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          label: t('name.label'),
          description: t('name.desc'),
          component: props => {
            const value: string = props.field.value ?? '';

            return (
              <>
                <AutoFormInput {...props} />
                {props.field.value.length > 0 && (
                  <span className="text-muted-foreground mt-2 block max-w-md truncate text-sm">
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
          component: props => <AutoFormInput {...props} type="email" />,
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
                <AutoFormInput {...props} type="password" />
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
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    >
      <div id="vitnode_captcha" />
    </AutoForm>
  );
};
