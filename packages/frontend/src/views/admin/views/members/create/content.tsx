import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { removeSpecialCharacters } from '@/helpers/special-characters';
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
          description: t('password.desc'),
          component: props => {
            const value: string = props.field.value ?? '';
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
                <AutoFormInput {...props} type="password" />
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
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    >
      <div id="vitnode_captcha" />
    </AutoForm>
  );
};
