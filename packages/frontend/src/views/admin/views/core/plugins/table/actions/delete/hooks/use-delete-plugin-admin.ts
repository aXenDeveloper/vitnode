import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationApi } from './mutation-api';

export const useDeletePluginAdmin = ({ id }: { id: number }) => {
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();

  const onSubmit = async () => {
    try {
      await mutationApi(id);
      setOpen(false);
      window.location.reload();
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return {
    onSubmit,
  };
};
