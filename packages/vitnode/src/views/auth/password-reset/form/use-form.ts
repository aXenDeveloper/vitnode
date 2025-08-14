import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import z from 'zod';

import { mutationApi } from './mutation-api';

export const useForm = () => {
  const t = useTranslations('core.auth.sign_in');
  const tError = useTranslations('core.global.errors');
  const [sentEmail, setSentEmail] = React.useState('');

  const formSchema = z.object({
    email: z.email({ message: t('email.invalid') }).default(''),
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const mutation = await mutationApi(data.email);
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
