import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useDevPluginAdmin } from '../../../hooks/use-dev-plugin';
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
  const { code } = useDevPluginAdmin();
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
  const { setOpen } = useDialog();

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      if (data) {
        await editMutationApi({
          ...values,
          parent_id: values.parent_id === 'null' ? undefined : values.parent_id,
          plugin_code: code,
          old_id: data.id,
        });
      } else {
        await createMutationApi({
          ...values,
          parent_id: values.parent_id === 'null' ? undefined : values.parent_id,
          plugin_code: code,
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
