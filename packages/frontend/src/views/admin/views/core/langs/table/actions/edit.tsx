import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

const Content = React.lazy(async () =>
  import('../../create-edit/create-edit').then(module => ({
    default: module.CreateEditLangAdmin,
  })),
);

export const EditActionsTableLangsCoreAdmin = (data: LanguagesAdminObj) => {
  const t = useTranslations('admin.core.langs.actions');
  const tCore = useTranslations('core.global');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button ariaLabel={tCore('edit')} size="icon" variant="ghost">
          <Pencil />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription>{data.name}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content data={data} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
