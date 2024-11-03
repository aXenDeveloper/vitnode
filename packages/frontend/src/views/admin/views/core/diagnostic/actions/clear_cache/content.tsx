import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationClearCache } from './hooks/mutation-api';

export const ContentClearCacheActionDiagnostic = () => {
  const t = useTranslations('admin.core.diagnostic.clear_cache');
  const tCore = useTranslations('core.global');

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_sure')}</AlertDialogTitle>
        <AlertDialogDescription>{t('desc')}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{tCore('cancel')}</AlertDialogCancel>
        <AlertDialogAction asChild>
          <Button
            onClick={async () => {
              await mutationClearCache();
              toast.success(t('success'));
            }}
            variant="destructive"
          >
            {t('confirm')}
          </Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
};
