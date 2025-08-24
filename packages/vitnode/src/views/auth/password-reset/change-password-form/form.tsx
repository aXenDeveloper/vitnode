'use client';

import { useTranslations } from 'next-intl';

import { AutoForm } from '@/components/form/auto-form';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { PasswordInput } from '../../sign-up/components/password-input';
import { useForm } from './use-form';

export const ChangePasswordForm = (props: {
  token: string;
  userId: string;
}) => {
  const t = useTranslations('core.auth.change_password');
  const tSignUp = useTranslations('core.auth.sign_up');
  const { formSchema, onSubmit } = useForm(props);

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>
          <h1>{t('title')}</h1>
        </CardTitle>
        <CardDescription>{t('desc')}</CardDescription>
      </CardHeader>

      <CardContent>
        <AutoForm
          fields={[
            {
              id: 'password',
              component: props => (
                <PasswordInput label={tSignUp('password.label')} {...props} />
              ),
            },
          ]}
          formSchema={formSchema}
          onSubmit={onSubmit}
          submitButtonProps={{
            className: 'w-full',
            children: t('submit'),
          }}
        />
      </CardContent>
    </>
  );
};
