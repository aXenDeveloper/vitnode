import { useTranslations } from 'next-intl';
import z from 'zod';

export const useForm = () => {
  const t = useTranslations('core.auth.sign_in');

  const formSchema = z.object({
    email: z.email({ message: t('email.invalid') }).default(''),
  });

  return {
    formSchema,
  };
};
