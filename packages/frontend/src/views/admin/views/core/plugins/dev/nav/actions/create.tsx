'use client';

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
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('../create-edit/create-edit').then(module => ({
    default: module.CreateEditNavDevPluginAdmin,
  })),
);

export const CreateNavDevPluginAdmin = (
  props: React.ComponentProps<typeof Content>,
) => {
  const t = useTranslations('admin.core.plugins.dev.nav.create');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('title')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('desc')}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
