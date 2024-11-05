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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTextLang } from '@/hooks/use-text-lang';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

const Content = React.lazy(async () =>
  import('../../create-edit/create-edit').then(module => ({
    default: module.ContentCreateEditNavAdmin,
  })),
);

export const EditActionTableNavAdmin = (
  props: Omit<ShowNavStyles, 'children'>,
) => {
  const t = useTranslations('admin.core.styles.nav.edit');
  const { convertText } = useTextLang();

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button ariaLabel={t('title')} size="icon" variant="ghost">
                <Pencil />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>

          <TooltipContent>{t('title')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{convertText(props.name)}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content data={props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
