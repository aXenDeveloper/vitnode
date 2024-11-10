import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

import { mutationApi } from './mutation-api';

export const useSignInAdminView = () => {
  const t = useTranslations('core.global.errors');
  const [error, setError] = React.useState<string>('');

  const formSchema = z.object({
    email: z.string().min(1).default(''),
    password: z.string().min(1).default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi({ ...values, admin: true });
    } catch (e) {
      const { message } = e as Error;
      if (message === 'NEXT_REDIRECT') return;
      if (message.includes('ACCESS_DENIED')) {
        setError('ACCESS_DENIED');

        return;
      }

      toast.error(t('title'), {
        description: t('internal_server_error'),
      });
    }
  };

  return {
    formSchema,
    onSubmit,
    error,
  };
};
