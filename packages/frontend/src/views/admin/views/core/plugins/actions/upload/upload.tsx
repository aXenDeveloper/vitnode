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
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./form').then(module => ({
    default: module.FormUploadPluginAdmin,
  })),
);

export const UploadActionPluginAdmin = () => {
  const t = useTranslations('admin.core.plugins.upload');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload />
          {t('title')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('desc')}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
