import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader } from '@/components/ui/loader';
import { useTranslations } from 'next-intl';
import React from 'react';

import { ContentDeletePluginActionsAdmin } from './content';

export const DeletePluginActionsAdmin = ({
  open,
  setOpen,
  ...props
}: React.ComponentProps<typeof ContentDeletePluginActionsAdmin> & {
  open: boolean;
  setOpen: (value: boolean) => void;
}) => {
  const t = useTranslations('admin.core.plugins.delete');
  const tCore = useTranslations('core.global');

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tCore('are_you_absolutely_sure')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich('desc', {
              name: () => (
                <span className="text-foreground font-bold">{props.name}</span>
              ),
              author: () => (
                <span className="text-foreground font-bold">
                  {props.author}
                </span>
              ),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentDeletePluginActionsAdmin {...props} />
        </React.Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
};
