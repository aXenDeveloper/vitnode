import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import { ContentDeleteActionTableNavDevPluginAdmin } from './content';

export const DeleteActionTableNavDevPluginAdmin = (
  props: React.ComponentProps<typeof ContentDeleteActionTableNavDevPluginAdmin>,
) => {
  const t = useTranslations('core.global');

  return (
    <AlertDialog>
      <TooltipWrapper content={t('delete')}>
        <AlertDialogTrigger asChild>
          <Button
            ariaLabel={t('delete')}
            size="icon"
            variant="destructiveGhost"
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
      </TooltipWrapper>

      <AlertDialogContent>
        <ContentDeleteActionTableNavDevPluginAdmin {...props} />
      </AlertDialogContent>
    </AlertDialog>
  );
};
