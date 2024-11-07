import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('../../create-edit/create-edit').then(module => ({
    default: module.CreateEditNavDevPluginAdmin,
  })),
);

export const EditActionTableNavDevPluginAdmin = (
  props: React.ComponentProps<typeof Content>,
) => {
  const t = useTranslations('admin.core.plugins.dev.nav');

  return (
    <Dialog>
      <TooltipWrapper content={t('edit.title')}>
        <DialogTrigger asChild>
          <Button ariaLabel={t('edit.title')} size="icon" variant="ghost">
            <Pencil />
          </Button>
        </DialogTrigger>
      </TooltipWrapper>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
