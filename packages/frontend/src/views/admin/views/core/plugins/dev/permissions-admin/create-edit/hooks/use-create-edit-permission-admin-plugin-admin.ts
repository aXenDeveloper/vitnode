import { useDialog } from '@/components/ui/dialog';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { PermissionsAdminWithI18n } from '../../permissions-admin';
import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateEditPermissionAdminPluginAdmin = ({
  dataWithI18n,
  data,
  parentId,
}: {
  data?: PermissionsAdminWithI18n;
  dataWithI18n: PermissionsAdminWithI18n[];
  parentId: string | undefined;
}) => {
  const t = useTranslations(
    'admin.core.plugins.dev.permissions-admin.create_edit',
  );
  const tCore = useTranslations('core.global.errors');
  const formSchema = z.object({
    id: z
      .string()
      .min(3)
      .max(50)
      .default(data?.id ?? ''),
    parent_id: z
      .enum(['null', ...dataWithI18n.map(item => item.id)])
      .default(parentId ?? 'null'),
  });
  const { code } = useParams();
  const { setOpen } = useDialog();

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    if (!code) return;
    try {
      if (data) {
        await editMutationApi({
          ...values,
          parent_id: values.parent_id === 'null' ? undefined : values.parent_id,
          plugin_code: Array.isArray(code) ? code[0] : code,
          old_id: data.id,
        });
      } else {
        await createMutationApi({
          ...values,
          parent_id: values.parent_id === 'null' ? undefined : values.parent_id,
          plugin_code: Array.isArray(code) ? code[0] : code,
        });
      }

      setOpen?.(false);
      toast.success(t('create_success'));
    } catch (err) {
      const error = err as Error;

      if (error.message.includes('PERMISSION_ALREADY_EXISTS')) {
        form.setError('id', {
          type: 'manual',
          message: t('id.exists'),
        });

        return;
      }

      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit };
};
