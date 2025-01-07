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
import { TooltipWrapper } from '@/components/ui/tooltip';
import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const ContentChangeAvatar = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentChangeAvatar,
  })),
);

export const ChangeAvatarWrapper = ({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof ContentChangeAvatar>) => {
  const t = useTranslations('core.settings.overview.change_avatar');

  return (
    <div className="relative inline-block flex-shrink-0">
      {children}
      <Dialog>
        <TooltipWrapper content={t('title')}>
          <DialogTrigger asChild>
            <Button
              ariaLabel={t('title')}
              className="absolute -right-1 bottom-0 size-8 [&>svg]:size-4"
              size="icon"
              variant="outline"
            >
              <PencilIcon />
            </Button>
          </DialogTrigger>
        </TooltipWrapper>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('desc')}</DialogDescription>
          </DialogHeader>

          <React.Suspense fallback={<Loader />}>
            <ContentChangeAvatar {...props} />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
};
