import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

import { mutationApi } from './mutation-api';

export const useSignInView = () => {
  const [error, setError] = React.useState('');
  const t = useTranslations('core.global.errors');

  const formSchema = z.object({
    email: z.string().email().default(''),
    password: z.string().min(1).default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setError('');
    const mutation = await mutationApi(values);
    if (!mutation?.message) return;
    if (mutation.message === 'EMAIL_NOT_VERIFIED') {
      setError('EMAIL_NOT_VERIFIED');

      return;
    }

    if (mutation.message === 'ACCESS_DENIED') {
      setError('ACCESS_DENIED');

      return;
    }

    toast.error(t('title'), {
      description: t('internal_server_error'),
    });
  };

  return {
    formSchema,
    onSubmit,
    error,
  };
};
