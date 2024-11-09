import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

import { PermissionsAdminWithI18n } from '../../../permissions-admin';
import { useDeletePermissionAdminPluginAdmin } from './hooks/use-delete-permission-admin-plugin-admin';
import { SubmitDeleteActionItemPermissionsAdminDevPluginAdmin } from './submit';

export const ContentDeleteActionItemPermissionsAdminDevPluginAdmin = ({
  id,
  parentId,
  permissions,
}: {
  parentId: string | undefined;
} & PermissionsAdminWithI18n) => {
  const t = useTranslations('admin.core.plugins.dev.permissions-admin.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit } = useDeletePermissionAdminPluginAdmin({ id, parentId });

  return (
    <form action={onSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_sure')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t.rich('desc', {
            id: () => <span className="text-foreground font-bold">{id}</span>,
          })}
        </AlertDialogDescription>

        {permissions.length > 0 && (
          <Alert variant="warn">
            <AlertTitle>{t('children_warn.title')}</AlertTitle>
            <AlertDescription>{t('children_warn.desc')}</AlertDescription>
          </Alert>
        )}
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>
        <SubmitDeleteActionItemPermissionsAdminDevPluginAdmin />
      </AlertDialogFooter>
    </form>
  );
};
