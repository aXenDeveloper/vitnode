'use client';

import { useTranslations } from 'next-intl';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';

import { useForm } from './use-form';

export const PasswordResetForm = () => {
  const { formSchema } = useForm();
  const t = useTranslations('core.auth.password_reset');
  const tSignIn = useTranslations('core.auth.sign_in');

  return (
    <AutoForm
      fields={[
        {
          id: 'email',
          component: props => (
            <AutoFormInput {...props} label={tSignIn('email.label')} />
          ),
        },
      ]}
      formSchema={formSchema}
      submitButtonProps={{
        className: 'w-full',
        children: t('submit'),
      }}
    />
  );
};
