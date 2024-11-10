import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';

export const ContentDeleteActionUserMembersAdmin = ({
  name,
}: Pick<UserMembersAdmin, 'name'>) => {
  const t = useTranslations('admin.members.users.item.delete');
  const tCore = useTranslations('core.global');
  const { pending } = useFormStatus();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_absolutely_sure')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t.rich('desc', {
            name: () => (
              <span className="text-foreground font-semibold">{name}</span>
            ),
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel asChild>
          <Button variant="ghost">{tCore('cancel')}</Button>
        </AlertDialogCancel>
        <Button loading={pending} type="submit" variant="destructive">
          {t('submit')}
        </Button>
      </AlertDialogFooter>
    </>
  );
};
