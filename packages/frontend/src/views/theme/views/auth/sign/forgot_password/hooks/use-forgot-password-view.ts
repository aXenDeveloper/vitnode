import { useCaptcha } from '@/hooks/use-captcha';
import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useForgotPasswordView = () => {
  const tError = useTranslations('core.global.errors');
  const [email, setEmail] = React.useState('');
  const { getTokenFromCaptcha, isReady } = useCaptcha();

  const formSchema = z.object({
    email: z.string().email().default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const token = await getTokenFromCaptcha();
    if (!token) return;

    try {
      await mutationApi({ ...values, token });
      setEmail(values.email);
    } catch (_) {
      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });
    }
  };

  return { formSchema, email, onSubmit, isReady };
};
