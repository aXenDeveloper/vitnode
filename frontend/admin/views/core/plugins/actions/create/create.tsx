'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, lazy } from 'react';

import { Loader } from '@/components/loader/loader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

const Content = lazy(() =>
  import('./content').then(module => ({
    default: module.ContentCreateActionsPluginsAdmin
  }))
);

export const CreateActionsPluginsAdmin = () => {
  const t = useTranslations('core');

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('create')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <Suspense fallback={<Loader />}>
          <Content />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};
