import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { useDeleteNavPluginAdmin } from './hooks/use-delete-nav-plugin-admin';
import { SubmitDeleteActionTableNavDevPluginAdmin } from './submit';

export const ContentDeleteActionTableNavDevPluginAdmin = ({
  code,
  parentId,
}: Pick<ParentNavAuthAdminObj, 'code'> & {
  parentId: string | undefined;
}) => {
  const t = useTranslations('admin.core.plugins.dev.nav.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit } = useDeleteNavPluginAdmin({ code, parentId });

  return (
    <form action={onSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_sure')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t.rich('desc', {
            code: () => (
              <span className="text-foreground font-bold">{code}</span>
            ),
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>
        <SubmitDeleteActionTableNavDevPluginAdmin />
      </AlertDialogFooter>
    </form>
  );
};
