import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

import { useDeletePluginAdmin } from './hooks/use-delete-plugin-admin';
import { SubmitContentDeletePluginActionsAdmin } from './submit';

export const ContentDeletePluginActionsAdmin = ({
  id,
}: Pick<ShowPluginAdmin, 'author' | 'id' | 'name'>) => {
  const t = useTranslations('admin.core.plugins.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit } = useDeletePluginAdmin({ id });

  return (
    <form action={onSubmit}>
      <Alert variant="primary">
        <AlertDescription>{t('info')}</AlertDescription>
      </Alert>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>

        <SubmitContentDeletePluginActionsAdmin />
      </AlertDialogFooter>
    </form>
  );
};
