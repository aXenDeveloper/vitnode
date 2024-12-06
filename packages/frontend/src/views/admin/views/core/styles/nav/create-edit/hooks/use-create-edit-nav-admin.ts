import { useDialog } from '@/components/ui/dialog';
import { zodLanguageInput } from '@/helpers/zod';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';

import { ContentCreateEditNavAdmin } from '../create-edit';
import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateEditNavAdmin = ({
  data,
}: React.ComponentProps<typeof ContentCreateEditNavAdmin>) => {
  const t = useTranslations('admin.core.styles.nav');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { convertText } = useTextLang();
  const formSchema = z.object({
    name: zodLanguageInput.min(1).default(data?.name ?? []),
    description: zodLanguageInput.default(data?.description ?? []).optional(),
    href: z
      .string()
      .min(1)
      .max(255)
      .default(data?.href ?? ''),
    external: z
      .boolean()
      .default(data?.external ?? false)
      .optional(),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (data) {
        await editMutationApi({
          ...values,
          id: data.id,
          description: values.description ?? [],
          external: values.external ?? false,
        });
      } else {
        await createMutationApi({
          ...values,
          description: values.description ?? [],
          external: values.external ?? false,
        });
      }

      toast.success(t(data ? 'edit.success' : 'create.success'), {
        description: convertText(values.name),
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
