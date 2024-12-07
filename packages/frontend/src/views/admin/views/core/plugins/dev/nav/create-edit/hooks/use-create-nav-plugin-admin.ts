import { useDialog } from '@/components/ui/dialog';
import { zodTag } from '@/helpers/zod';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useDevPluginAdmin } from '../../../hooks/use-dev-plugin';
import { CreateEditNavDevPluginAdmin } from '../create-edit';
import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateNavPluginAdmin = ({
  data,
  parentId,
  dataFromSSR,
}: Omit<
  React.ComponentProps<typeof CreateEditNavDevPluginAdmin>,
  'textsAndIcons'
>) => {
  const t = useTranslations('admin.core.plugins.dev.nav');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { pluginCode } = useDevPluginAdmin();

  const formSchema = z.object({
    code: z
      .string()
      .min(3)
      .max(50)
      .default(data?.code ?? ''),
    parent_code: z
      .enum(['null', ...dataFromSSR.map(nav => nav.code)])
      .default(parentId ?? 'null'),
    icon: z
      .string()
      .default(data?.icon ?? '')
      .optional(),
    keywords: zodTag
      .default(
        data?.keywords.map(keyword => ({
          id: Math.random() * 1000,
          value: keyword,
        })) ?? [],
      )
      .optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    if (!pluginCode) return;

    try {
      if (data) {
        await editMutationApi({
          ...values,
          previous_code: data.code,
          plugin_code: pluginCode,
          parent_code:
            values.parent_code === 'null' ? undefined : values.parent_code,
          keywords: (values.keywords ?? []).map(keyword => keyword.value),
        });
      } else {
        await createMutationApi({
          ...values,
          plugin_code: pluginCode,
          parent_code:
            values.parent_code === 'null' ? undefined : values.parent_code,
          keywords: (values.keywords ?? []).map(keyword => keyword.value),
        });
      }

      setOpen?.(false);
      toast.success(t(data ? 'edit.success' : 'create.success'), {
        description: values.code,
      });
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('CODE_ALREADY_EXISTS')) {
        form.setError('code', {
          message: t('create.code.exists'),
        });

        return;
      }

      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return {
    onSubmit,
    formSchema,
  };
};
