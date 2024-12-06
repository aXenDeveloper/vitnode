import { useDialog } from '@/components/ui/dialog';
import { zodComboBoxWithFetcher } from '@/helpers/zod';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { AdminStaffMembersAdminObj } from 'vitnode-shared/admin/members/staff/admin.dto';
import { z } from 'zod';

import { createMutationApi, editMutationApi } from './mutation-api';

export const useFormCreateEditFormGroupsMembersAdmin = ({
  data,
}: {
  data?: AdminStaffMembersAdminObj['edges'][0];
}) => {
  const t = useTranslations('admin.members.staff.admin');
  const tShared = useTranslations('admin.members.staff.shared');
  const tCore = useTranslations('core.global');
  const { convertText } = useTextLang();
  const { setOpen } = useDialog();

  const formSchema = z
    .object({
      type: z
        .enum(['group', 'user'])
        .default(data && 'name_seo' in data.user_or_group ? 'user' : 'group'),
      user: zodComboBoxWithFetcher
        .default(
          data && 'name_seo' in data.user_or_group
            ? [
                {
                  key: data.user_or_group.id.toString(),
                  value: data.user_or_group.name,
                },
              ]
            : [],
        )
        .optional(),
      group: zodComboBoxWithFetcher
        .default(
          data && 'group_name' in data.user_or_group
            ? [
                {
                  key: data.user_or_group.id.toString(),
                  value: data.user_or_group.group_name,
                },
              ]
            : [],
        )
        .optional(),
      unrestricted: z
        .boolean()
        .default(data ? data.permissions.length === 0 : true),
      permissions: z
        .array(
          z.object({
            plugin_code: z.string(),
            groups: z.array(
              z.object({
                id: z.string(),
                permissions: z.array(z.string()),
              }),
            ),
          }),
        )
        .default(data?.permissions ?? []),
    })
    .refine(data => {
      return data.type === 'group' ? data.group : data.user;
    });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      if (data) {
        await editMutationApi({
          id: data.id,
          permissions: values.unrestricted ? [] : values.permissions,
        });
      } else {
        await createMutationApi({
          group_id:
            values.type === 'group' && values.group?.[0].key
              ? +values.group[0].key
              : null,
          user_id:
            values.type === 'user' && values.user?.[0].key
              ? +values.user[0].key
              : null,
          permissions: values.unrestricted ? [] : values.permissions,
        });
      }

      setOpen?.(false);
      toast.success(t(data ? 'edit.success' : 'add.success'), {
        description:
          values.type === 'group' && Array.isArray(values.group?.[0].value)
            ? convertText(values.group[0].value)
            : Array.isArray(values.user?.[0].value)
              ? null
              : values.user?.[0].value,
      });
    } catch (err) {
      const error = err as Error;

      if (error.message.includes('ALREADY_EXISTS')) {
        form.setError(values.type === 'user' ? 'user' : 'group', {
          type: 'manual',
          message: tShared('already_exists'),
        });

        return;
      }

      toast.error(tCore('errors.title'), {
        description: tCore('errors.internal_server_error'),
      });
    }
  };

  return {
    formSchema,
    onSubmit,
  };
};
