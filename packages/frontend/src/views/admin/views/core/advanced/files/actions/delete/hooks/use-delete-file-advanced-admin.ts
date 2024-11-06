import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationApi } from './mutation-api';

export const useDeleteFileAdvancedAdmin = ({
  file_name_original,
  id,
}: {
  file_name_original: string;
  id: number;
}) => {
  const t = useTranslations('admin.core.advanced.files.delete');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();

  const onSubmit = async () => {
    try {
      await mutationApi(id);
      toast.success(t('success'), {
        description: file_name_original,
      });
      setOpen(false);
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { onSubmit };
};
