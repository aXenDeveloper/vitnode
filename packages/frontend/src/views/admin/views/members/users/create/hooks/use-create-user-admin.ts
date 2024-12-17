import { useDialog } from '@/components/ui/dialog';
import { useCaptcha } from '@/hooks/use-captcha';
import { nameRegex } from '@/views/theme/views/auth/sign/up/hooks/use-sign-up-view';
import { useTranslations } from 'next-intl';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useCreateUserAdmin = () => {
  const t = useTranslations('admin.members.users.create');
  const tSignUp = useTranslations('core.sign_up');
  const tCore = useTranslations('core.global.errors');
  const [values, setValues] = React.useState<
    Partial<z.infer<typeof formSchema>>
  >({});
  const { setOpen } = useDialog();
  const { getTokenFromCaptcha, isReady } = useCaptcha();

  const formSchema = z.object({
    name: z
      .string()
      .min(3, {
        message: tCore('min_length', { length: 3 }),
      })
      .max(32, {
        message: tCore('max_length', { length: 32 }),
      })
      .refine(value => nameRegex.test(value), {
        message: tSignUp('name.invalid'),
      })
      .default(''),
    email: z
      .string()
      .email({
        message: tSignUp('email_invalid'),
      })
      .default(''),
    password: z
      .string()
      .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/)
      .default(''),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const token = await getTokenFromCaptcha();
    if (!token) {
      toast.error(tCore('title'), {
        description: tCore('captcha_empty'),
      });

      return;
    }

    const mutation = await mutationApi({
      ...values,
      token,
    });
    if (!mutation?.message) {
      setOpen?.(false);
      toast.success(t('success'), {
        description: values.name,
      });

      return;
    }

    if (mutation.message === 'EMAIL_ALREADY_EXISTS') {
      form.setError(
        'email',
        {
          type: 'manual',
          message: tSignUp('email.already_exists'),
        },
        {
          shouldFocus: true,
        },
      );

      return;
    }

    if (mutation.message === 'NAME_ALREADY_EXISTS') {
      form.setError(
        'name',
        {
          type: 'manual',
          message: tSignUp('name.already_exists'),
        },
        {
          shouldFocus: true,
        },
      );

      return;
    }

    toast.error(tCore('title'), {
      description: tCore('internal_server_error'),
    });
  };

  return { formSchema, onSubmit, values, setValues, isReady };
};
