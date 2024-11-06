import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { ShowFilesAdvancedAdmin } from 'vitnode-shared/admin/advanced/files.dto';

import { useDeleteFileAdvancedAdmin } from './hooks/use-delete-file-advanced-admin';
import { SubmitDeleteActionFilesAdvancedCoreAdmin } from './submit';

export const ContentDeleteActionFilesAdvancedCoreAdmin = ({
  count_uses,
  file_name_original,
  id,
}: Pick<
  ShowFilesAdvancedAdmin,
  'count_uses' | 'file_name_original' | 'id'
>) => {
  const t = useTranslations('admin.core.advanced.files.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit } = useDeleteFileAdvancedAdmin({
    file_name_original,
    id,
  });

  return (
    <form action={onSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {tCore(count_uses > 0 ? 'are_you_absolutely_sure' : 'are_you_sure')}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {t.rich('desc', {
            name: () => (
              <span className="text-foreground font-bold">
                {file_name_original}
              </span>
            ),
          })}
        </AlertDialogDescription>
        {count_uses > 0 && (
          <AlertDialogDescription className="text-destructive">
            {t('uses_warning')}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>

        <SubmitDeleteActionFilesAdvancedCoreAdmin />
      </AlertDialogFooter>
    </form>
  );
};
