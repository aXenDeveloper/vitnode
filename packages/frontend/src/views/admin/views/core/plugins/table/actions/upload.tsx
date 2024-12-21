import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('../../actions/upload/form').then(module => ({
    default: module.FormUploadPluginAdmin,
  })),
);

export const UploadPluginActionsAdmin = ({
  open,
  setOpen,
  data,
}: Required<Pick<React.ComponentProps<typeof Content>, 'data'>> & {
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const t = useTranslations('admin.core.plugins.upload');

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title_new_version')}</DialogTitle>
          <DialogDescription>{data.name}</DialogDescription>
        </DialogHeader>

        <Alert variant="primary">
          <AlertDescription>{t('info')}</AlertDescription>
        </Alert>

        <Content data={data} />
      </DialogContent>
    </Dialog>
  );
};
