import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ContentDeleteContentLegalSettingsAdmin } from './content';

export const DeleteContentLegalSettingsAdmin = (
  props: React.ComponentProps<typeof ContentDeleteContentLegalSettingsAdmin>,
) => {
  const t = useTranslations('admin.core.settings.legal.delete');

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button ariaLabel={t('title')} size="icon" variant="destructiveGhost">
          <Trash2 />
        </Button>
      </AlertDialogTrigger>

      <ContentDeleteContentLegalSettingsAdmin {...props} />
    </AlertDialog>
  );
};
