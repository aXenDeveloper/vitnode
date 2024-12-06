import { fetcherClient } from '@/api/fetcher-client';
import { getHSLFromString, isColorBrightness } from '@/helpers/colors';
import { zodFile } from '@/helpers/zod';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import {
  EditEmailSettingsAdminBody,
  ShowEmailSettingsAdminObj,
} from 'vitnode-shared/admin/settings/email.dto';
import { z } from 'zod';

import { ContentEmailSettingsAdmin } from '../content';
import { revalidateApi } from './revalidate-api';

export const useEmailSettingsFormAdmin = (
  data: React.ComponentProps<typeof ContentEmailSettingsAdmin>,
) => {
  const t = useTranslations('core.global');
  const formSchema = z.object({
    color_primary: z.string().default(data.color_primary),
    logo: zodFile
      .nullable()
      .default(data.logo ?? null)
      .optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const primaryHSL = getHSLFromString(values.color_primary);
    if (!primaryHSL) return;

    const formData = new FormData();
    formData.append('color_primary', values.color_primary);
    formData.append(
      'color_primary_foreground',
      `hsl(${isColorBrightness(primaryHSL) ? `${primaryHSL.h}, 40%, 2%` : `${primaryHSL.h}, 40%, 98%`})`,
    );

    if (values.logo) {
      if (values.logo instanceof File) {
        formData.append('logo', values.logo);
      }
    } else {
      formData.append('delete_logo', 'true');
    }

    try {
      await fetcherClient<
        ShowEmailSettingsAdminObj,
        EditEmailSettingsAdminBody
      >({
        url: '/admin/settings/email',
        method: 'PUT',
        body: formData,
      });
      await revalidateApi();

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
