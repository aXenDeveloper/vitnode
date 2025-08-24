import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import z from 'zod';

import type { AutoFormOnSubmit } from '@/components/form/auto-form';

import { mutationApi } from './mutation-api';

export const useForm = () => {
  const t = useTranslations('core.auth.sign_up');
  const tError = useTranslations('core.global.errors');
  const [sentEmail, setSentEmail] = React.useState('');

  const formSchema = z.object({
    email: z.email({ message: t('email.invalid') }).default(''),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    data,
    _form,
    { captchaToken },
  ) => {
    const mutation = await mutationApi({ email: data.email, captchaToken });
    if (mutation?.error) {
      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });

      return;
    }

    setSentEmail(data.email);
  };

  return {
    formSchema,
    onSubmit,
    sentEmail,
  };
};
