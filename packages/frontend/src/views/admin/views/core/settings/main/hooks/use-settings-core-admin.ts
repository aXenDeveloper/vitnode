import { zodLanguageInput } from '@/helpers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useSettingsCoreAdmin = (data: ShowMiddlewareObj) => {
  const t = useTranslations('core.global');

  const formSchema = z.object({
    site_name: z.string().min(1).default(data.site_name),
    site_short_name: z.string().min(1).default(data.site_short_name),
    site_description: zodLanguageInput
      .default(data.site_description ?? [])
      .optional(),
    contact_email: z.string().email().default(data.contact_email),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi(values);

      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return {
    onSubmit,
    formSchema,
  };
};
