import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useFormSignUp = () => {
  const t = useTranslations('core.auth.sign_up');
  const tError = useTranslations('core.global.errors');
  const invalidPassword = t('password.invalid');
  const formSchema = z.object({
    name: z
      .string({
        message: tError('field_required'),
      })
      .min(3, t('username.min_length'))
      .max(32, t('username.max_length')),
    // .refine(value => nameRegex.test(value), t('name.invalid'))
    email: z
      .string({
        message: tError('field_required'),
      })
      .email(t('email.invalid')),
    password: z
      .string({
        message: tError('field_required'),
      })
      .regex(/^.{8,}$/, invalidPassword)
      .regex(/[A-Z]/, invalidPassword)
      .regex(/\d/, invalidPassword)
      .regex(/\W|_/, invalidPassword),
    terms: z.boolean().refine(value => value, t('terms.required')),
    newsletter: z.boolean().optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const mutation = await mutationApi({
      json: values,
    });
    if (!mutation?.message) {
      toast('Event has been created.');

      return;
    }

    const errorMessages = {
      'Email already exists': {
        field: 'email',
        message: t('email.exists'),
      },
      'Name already exists': {
        field: 'name',
        message: t('username.exists'),
      },
    } as const;

    const errorConfig =
      errorMessages[mutation.message as keyof typeof errorMessages];

    if (errorConfig) {
      form.setError(
        errorConfig.field,
        {
          type: 'manual',
          message: errorConfig.message,
        },
        {
          shouldFocus: true,
        },
      );

      return;
    }

    toast.error(tError('title'), {
      description: tError('internal_server_error'),
    });
  };

  return { onSubmit, formSchema };
};
