import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('../create-edit-form/create-edit-form').then(module => ({
    default: module.CreateEditFormAdministratorsStaffAdmin,
  })),
);

export const CreateActionsAdministratorsStaffAdmin = (
  props: React.ComponentProps<typeof Content>,
) => {
  const t = useTranslations('admin.members.staff.admin.add');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('title')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex flex-col gap-4">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
