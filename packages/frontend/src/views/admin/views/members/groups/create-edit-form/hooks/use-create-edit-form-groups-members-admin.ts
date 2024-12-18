import { useDialog } from '@/components/ui/dialog';
import { zodLanguageInput } from '@/helpers/zod';
import { useTextLang } from '@/hooks/use-text-lang';
import { usePathname, useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CreateGroupsMembersAdminBody } from 'vitnode-shared/admin/members/groups.dto';
import { z } from 'zod';

import { CreateEditFormGroupsMembersAdmin } from '../create-edit-form-groups-members-admin';
import { mutationCreateApi } from './mutation-create-api';
import { mutationEditApi } from './mutation-edit-api';

export const useCreateEditFormGroupsMembersAdmin = ({
  data,
}: React.ComponentProps<typeof CreateEditFormGroupsMembersAdmin>) => {
  const t = useTranslations('admin.members.groups');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { convertText } = useTextLang();
  const pathname = usePathname();
  const { push } = useRouter();

  const formSchema = z.object({
    main: z.object({
      name: zodLanguageInput.min(1).default(data?.name ?? []),
      color: z
        .string()
        .default(data?.color ?? '')
        .optional(),
    }),
    content: z.object({
      files_allow_upload: z
        .boolean()
        .default(data?.content.files_allow_upload ?? true)
        .optional(),
      files_total_max_storage: z.coerce
        .number()
        .min(-1)
        .default(data?.content.files_total_max_storage ?? 500000),
      files_max_storage_for_submit: z.coerce
        .number()
        .min(-1)
        .default(data?.content.files_max_storage_for_submit ?? 5000),
    }),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const variables: CreateGroupsMembersAdminBody = {
      name: values.main.name,
      color: values.main.color,
      content: {
        files_allow_upload: values.content.files_allow_upload ?? true,
        files_total_max_storage: values.content.files_total_max_storage,
        files_max_storage_for_submit:
          values.content.files_max_storage_for_submit,
      },
    };

    try {
      if (data) {
        await mutationEditApi({
          id: data.id,
          ...variables,
        });
      } else {
        await mutationCreateApi(variables);
      }

      toast.success(data ? t('edit.success') : t('create.success'), {
        description: convertText(values.main.name),
      });
      setOpen?.(false);
      push(pathname);
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit };
};
