import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';
import { z } from 'zod';

import { mutationCreateApi } from './mutation-create-api';
import { mutationEditApi } from './mutation-edit-api';

export const codePluginRegex = /^[a-z0-9-]*$/;

export const useCreateEditPluginAdmin = ({
  data,
  user,
}: {
  data?: ShowPluginAdmin;
  user: UserWithDangerousInfo;
}) => {
  const t = useTranslations('admin.core.plugins');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();

  const formSchema = z.object({
    name: z
      .string()
      .min(3)
      .max(50)
      .default(data?.name ?? ''),
    description: z
      .string()
      .default(data?.description ?? '')
      .optional(),
    code: z
      .string()
      .min(3)
      .max(50)
      .refine(value => codePluginRegex.test(value), {
        message: t('create.code.invalid'),
      })
      .default(data?.code ?? ''),
    support_url: z
      .string()
      .url()
      .default(data?.support_url ?? ''),
    author: z
      .string()
      .min(3)
      .max(100)
      .default(data ? data.author : (user?.name ?? '')),
    author_url: z
      .string()
      .url()
      .or(z.literal(''))
      .default(data?.author_url ?? '')
      .optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      if (data) {
        await mutationEditApi(values);
        toast.error(t('edit.success'), {
          description: values.name,
        });
      } else {
        await mutationCreateApi(values);
        setOpen?.(false);
        await new Promise<void>(resolve => {
          setTimeout(() => {
            window.location.reload();
            resolve();
          }, 350);
        });
      }
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('PLUGIN_ALREADY_EXISTS')) {
        form.setError('code', {
          message: t('create.code.exists'),
        });

        return;
      }

      toast.error(tCore('title'), {
        description: error.message,
      });
    }
  };

  return {
    formSchema,
    onSubmit,
  };
};
