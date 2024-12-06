import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useSignInAdminView = () => {
  const t = useTranslations('core.global.errors');
  const [error, setError] = React.useState<string>('');

  const formSchema = z.object({
    email: z.string().min(1).default(''),
    password: z.string().min(1).default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const mutation = await mutationApi({ ...values, admin: true });
    if (!mutation?.message) return;
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
