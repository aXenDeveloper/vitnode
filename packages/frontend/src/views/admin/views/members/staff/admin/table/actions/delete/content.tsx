import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useAlertDialog,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AdminStaffMembersAdminObj } from 'vitnode-shared/admin/members/staff/admin.dto';

import { mutationApi } from './mutation-api';
import { SubmitDeleteActionsTableAdministratorsStaffAdmin } from './submit';

export const ContentDeleteActionsAdministratorsStaffAdmin = ({
  data: { id },
}: {
  data: Pick<AdminStaffMembersAdminObj['edges'][0], 'id'>;
}) => {
  const t = useTranslations('admin.members.staff.admin.delete');
  const tCore = useTranslations('core.global');
  const { setOpen } = useAlertDialog();

  const onSubmit = async () => {
    try {
      await mutationApi(id);
      toast.success(t('success'));
      setOpen(false);
    } catch (_) {
      toast.error(tCore('errors.title'), {
        description: tCore('errors.internal_server_error'),
      });
    }
  };

  return (
    <form action={onSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_absolutely_sure')}</AlertDialogTitle>
        <AlertDialogDescription>{t('desc')}</AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>
        <SubmitDeleteActionsTableAdministratorsStaffAdmin />
      </AlertDialogFooter>
    </form>
  );
};
