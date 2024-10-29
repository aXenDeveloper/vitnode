import {
  AlertDialogContent,
  useAlertDialog,
} from '@/components/ui/alert-dialog';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';

import { ContentDeleteActionUserMembersAdmin } from './content';
import { mutationApi } from './mutation-api';

export const DeleteActionUserMembersAdmin = ({
  name,
  id,
}: Pick<UserMembersAdmin, 'id' | 'name'>) => {
  const t = useTranslations('admin.members.users.item.delete');
  const tError = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();
  const { push } = useRouter();

  const onSubmit = async () => {
    try {
      await mutationApi(id);

      setOpen(false);
      push('/admin/members/users');
      toast.success(t('success'), {
        description: name,
      });
    } catch (_) {
      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });
    }
  };

  return (
    <AlertDialogContent>
      <form action={onSubmit}>
        <ContentDeleteActionUserMembersAdmin name={name} />
      </form>
    </AlertDialogContent>
  );
};
