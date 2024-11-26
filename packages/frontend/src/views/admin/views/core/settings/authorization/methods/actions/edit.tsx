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
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

const Content = React.lazy(async () =>
  import('../create-edit/content').then(module => ({
    default: module.ContentCreateEditMethodsAuthSettingsAdmin,
  })),
);

export const EditActionMethodsAuthSettingsAdmin = (
  props: {
    data: ShowMethodAuthSettingsAdminObj['edges'][0];
  } & Omit<React.ComponentProps<typeof Content>, 'data'>,
) => {
  const t = useTranslations('admin.core.settings.authorization.methods.edit');

  return (
    <Dialog>
      <TooltipWrapper content={t('title')}>
        <DialogTrigger asChild>
          <Button ariaLabel={t('title')} size="icon" variant="ghost">
            <Pencil />
          </Button>
        </DialogTrigger>
      </TooltipWrapper>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {props.data && (
            <DialogDescription>{props.data.name}</DialogDescription>
          )}
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
