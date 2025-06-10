'use client';

import { Button } from '@vitnode/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@vitnode/core/components/ui/dialog';
import { Loader } from '@vitnode/core/components/ui/loader';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const CreateEditActionCategoriesAdmin = React.lazy(async () =>
  import('./create-edit/create-edit').then(mod => ({
    default: mod.CreateEditActionCategoriesAdmin,
  })),
);

export const ActionsCategoriesAdmin = () => {
  const t = useTranslations('@vitnode/blog.admin.categories.create');

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <PlusIcon />
            {t('title')}
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('desc')}</DialogDescription>
          </DialogHeader>

          <React.Suspense fallback={<Loader />}>
            <CreateEditActionCategoriesAdmin />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
};
