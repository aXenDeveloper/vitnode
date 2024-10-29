import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTextLang } from '@/hooks/use-text-lang';
import { usePathname, useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';
import * as z from 'zod';

import { mutationApi } from './mutation-api';

export const useDeleteGroupAdmin = ({
  id,
  name,
}: Pick<GroupsMembersAdminObj['edges'][0], 'id' | 'name'>) => {
  const t = useTranslations('admin.members.groups.delete');
  const tCore = useTranslations('core.global.errors');
  const { convertText } = useTextLang();
  const formatName = convertText(name);
  const { setOpen } = useAlertDialog();
  const pathname = usePathname();
  const { push } = useRouter();

  const formSchema = z.object({
    name: z.string().refine(value => value === formatName),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.name !== formatName) return;
    try {
      await mutationApi(id);

      push(pathname);
      toast.success(t('success'), {
        description: values.name,
      });
      setOpen(false);
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { onSubmit, formSchema };
};
