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

import { ContentDeleteActionTableNavAdmin } from './content';

export const DeleteActionTableNavAdmin = (
  props: React.ComponentProps<typeof ContentDeleteActionTableNavAdmin>,
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
        <ContentDeleteActionTableNavAdmin {...props} />
      </AlertDialogContent>
    </AlertDialog>
  );
};
