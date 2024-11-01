import { useDialog } from '@/components/ui/dialog';
import { zodLanguageInput } from '@/helpers/zod';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { LegalsObj } from 'vitnode-shared/legal.dto';
import * as z from 'zod';

import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateEditLegalAdmin = ({
  data,
}: {
  data?: LegalsObj['edges'][0];
}) => {
  const t = useTranslations('admin.core.settings.legal.create_edit');
  const tCore = useTranslations('core.global.errors');
  const { convertText } = useTextLang();
  const { setOpen } = useDialog();

  const formSchema = z
    .object({
      title: zodLanguageInput.default(data?.title ?? []),
      content: zodLanguageInput.default(data?.content ?? []).optional(),
      code: z.string().default(data?.code ?? ''),
      external_href: z.boolean().default(!!data?.href).optional(),
      href: z
        .string()
        .default(data?.href ?? '')
        .optional(),
    })
    .refine(data => {
      if (data.external_href) {
        return data.href;
      }

      return data.content?.length;
    });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const body: CreateLegalSettingsAdminBody = {
      title: values.title,
      content: values.external_href ? [] : (values.content ?? []),
      href: values.external_href ? values.href : undefined,
      code: values.code,
    };

    try {
      if (data) {
        await editMutationApi({
          ...body,
          id: data.id,
          prevCode: data.code,
        });
      } else {
        await createMutationApi(body);
      }

      setOpen?.(false);
      toast.success(t(`success.${data ? 'edit' : 'create'}`), {
        description: convertText(values.title),
      });
    } catch (e) {
      const error = e as Error;

      if (error.message.includes('ALREADY_EXISTS')) {
        form.setError('code', {
          message: t('form.code.already_exists'),
        });

        return;
      }

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
