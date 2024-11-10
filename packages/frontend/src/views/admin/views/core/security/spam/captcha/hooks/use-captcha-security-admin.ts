import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { CaptchaTypeEnum } from 'vitnode-shared/utils/global';
import * as z from 'zod';

import { ContentCaptchaSpamSecurityAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useCaptchaSecurityAdmin = ({
  type,
  secret_key,
  site_key,
}: React.ComponentProps<typeof ContentCaptchaSpamSecurityAdmin>) => {
  const t = useTranslations('core.global');
  const formSchema = z
    .object({
      type: z
        .enum([
          CaptchaTypeEnum.none,
          CaptchaTypeEnum.cloudflare_turnstile,
          CaptchaTypeEnum.recaptcha_v3,
          CaptchaTypeEnum.recaptcha_v2_invisible,
          CaptchaTypeEnum.recaptcha_v2_checkbox,
        ])
        .default(type),
      secret_key: z.string().default(secret_key),
      site_key: z.string().default(site_key),
    })
    .refine(input => {
      if (input.type === CaptchaTypeEnum.none) {
        return true;
      }

      return input.secret_key !== '' && input.site_key !== '';
    });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      await mutationApi(values);
      toast.success(t('saved_success'));
      form.reset(values);
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return { onSubmit, formSchema };
};
