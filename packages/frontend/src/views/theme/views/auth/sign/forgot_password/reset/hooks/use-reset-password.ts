import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { ForgotPasswordView } from '../../forgot_password-view';
import { mutationApi } from './mutation-api';

export const useResetPassword = ({
  token,
  userId,
}: React.ComponentProps<typeof ForgotPasswordView>) => {
  const t = useTranslations('core.sign_in.forgot_password.change_password');
  const tError = useTranslations('core.global.errors');
  const [isSuccess, setIsSuccess] = React.useState(false);
  const formSchema = z.object({
    password: z
      .string()
      .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/)
      .default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!token || !userId) return;

    try {
      await mutationApi({
        password: values.password,
        token,
        user_id: +userId,
      });
      setIsSuccess(true);
    } catch (_) {
      toast.error(tError('title'), {
        description: t('error'),
      });
    }
  };

  return { formSchema, onSubmit, isSuccess };
};
