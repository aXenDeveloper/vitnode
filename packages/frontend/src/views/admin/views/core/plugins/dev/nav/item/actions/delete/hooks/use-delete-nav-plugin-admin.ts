import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ContentDeleteActionTableNavDevPluginAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useDeleteNavPluginAdmin = ({
  code,
  parentId,
}: React.ComponentProps<typeof ContentDeleteActionTableNavDevPluginAdmin>) => {
  const t = useTranslations('admin.core.plugins.dev.nav.delete');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();
  const { code: pluginCode } = useParams();

  const onSubmit = async () => {
    if (!pluginCode) return;

    try {
      await mutationApi({
        code,
        plugin_code: Array.isArray(pluginCode) ? pluginCode[0] : pluginCode,
        parent_code: parentId,
      });

      setOpen(false);
      toast.success(t('success'), {
        description: code,
      });
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { onSubmit };
};
