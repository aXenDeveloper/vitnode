import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';
import { AllowTypeFilesEnum } from 'vitnode-shared/utils/global';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useEditorAdmin = (data: ShowMiddlewareObj['editor']) => {
  const t = useTranslations('core.global');
  const formSchema = z.object({
    sticky: z.boolean().default(data.sticky),
    files: z.object({
      allow_type: z
        .nativeEnum(AllowTypeFilesEnum)
        .default(data.files.allow_type),
    }),
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

  return {
    formSchema,
    onSubmit,
  };
};
