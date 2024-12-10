import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { CreateEditLangAdmin } from '../create-edit';
import { timeZones } from '../timezones';
import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateEditLangAdmin = ({
  data,
}: React.ComponentProps<typeof CreateEditLangAdmin>) => {
  const t = useTranslations('admin.core.langs.actions');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();

  const formSchema = z.object({
    name: z
      .string()
      .min(1)
      .default(data?.name ?? ''),
    timezone: z
      .enum(timeZones as [string, ...string[]])
      .default(data?.timezone ?? 'America/New_York'),
    code: z
      .string()
      .min(1)
      .default(data?.code ?? ''),
    default: z
      .boolean()
      .default(data?.default ?? false)
      .optional(),
    time_24: z
      .boolean()
      .default(data?.time_24 ?? false)
      .optional(),
    allow_in_input: z
      .boolean()
      .default(data?.allow_in_input ?? true)
      .optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      if (data) {
        await editMutationApi({
          ...data,
          ...values,
          time_24: values.time_24 ?? false,
          allow_in_input: values.allow_in_input ?? true,
        });
      } else {
        const mutation = await createMutationApi({
          ...values,
          time_24: values.time_24 ?? false,
          allow_in_input: values.allow_in_input ?? true,
        });

        if (mutation?.message) {
          if (mutation.message === 'ALREADY_EXISTS') {
            form.setError('code', {
              message: t('create.code.already_exists'),
            });
          }

          return;
        }
      }

      toast(t(data ? 'edit.success' : 'create.success'), {
        description: values.name,
      });
      setOpen?.(false);
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return {
    formSchema,
    onSubmit,
  };
};
