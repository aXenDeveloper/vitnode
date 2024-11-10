'use client';

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

const CreateEditContent = React.lazy(async () =>
  import('./create-edit/create-edit').then(module => ({
    default: module.CreateEditPermissionsAdminDevPluginAdmin,
  })),
);

export const ActionsPermissionsAdminDevPluginAdmin = (
  props: React.ComponentProps<typeof CreateEditContent>,
) => {
  const t = useTranslations('core.global');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('create')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('create')}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditContent {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
