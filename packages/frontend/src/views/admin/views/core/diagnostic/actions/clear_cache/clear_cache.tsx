import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { EraserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import { ContentClearCacheActionDiagnostic } from './content';

export const ClearCacheActionDiagnostic = () => {
  const t = useTranslations('admin.core.diagnostic.clear_cache');

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>
            <EraserIcon />
            {t('title')}
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <ContentClearCacheActionDiagnostic />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
