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
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import { Plus, SquareArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./form').then(module => ({
    default: module.FormCreateEditPluginAdmin,
  })),
);

export const CreateActionPluginAdmin = () => {
  const t = useTranslations('admin.core.plugins');

  if (!CONFIG.node_development) {
    return (
      <Button asChild>
        <Link
          href="https://vitnode.com/docs/dev/plugins"
          rel="noreferrer noopener"
          target="_blank"
        >
          <Plus />
          {t('create.title')}
          <SquareArrowUpRight />
        </Link>
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('create.title')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
