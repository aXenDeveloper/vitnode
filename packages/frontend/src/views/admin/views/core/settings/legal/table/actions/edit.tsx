import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CreateEditLegalPage } from '../../create_edit/create_edit';

export const EditContentLegalSettingsAdmin = (
  props: React.ComponentProps<typeof CreateEditLegalPage>['data'],
) => {
  const t = useTranslations('admin.core.settings.legal.create_edit');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button ariaLabel={t('edit')} size="icon" variant="ghost">
          <Pencil />
        </Button>
      </DialogTrigger>

      <CreateEditLegalPage data={props} />
    </Dialog>
  );
};
