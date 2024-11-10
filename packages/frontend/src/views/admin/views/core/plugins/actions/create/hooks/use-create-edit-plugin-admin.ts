import { useDialog } from '@/components/ui/dialog';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';
import * as z from 'zod';

import { mutationCreateApi } from './mutation-create-api';
import { mutationEditApi } from './mutation-edit-api';

export const codePluginRegex = /^[a-z0-9-]*$/;

export const useCreateEditPluginAdmin = ({
  data,
}: {
  data?: ShowPluginAdmin;
}) => {
  const t = useTranslations('admin.core.plugins');
  const tCore = useTranslations('core.global.errors');
  const { user } = useSessionAdmin();
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
      await new Promise<void>(resolve => {
        setTimeout(() => {
          form.reset(values);
          resolve();
        }, 0);
      });

      if (data) {
        await mutationEditApi({
          ...values,
          default: data.default,
        });

        toast.error(t('edit.success'), {
          description: values.name,
        });
      } else {
        await mutationCreateApi(values);
        setOpen?.(false);
        window.location.reload();
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
