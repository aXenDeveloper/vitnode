import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useDevPluginAdmin } from '../../../../../hooks/use-dev-plugin';
import { ContentDeleteActionTableNavDevPluginAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useDeleteNavPluginAdmin = ({
  code,
  parentId,
}: React.ComponentProps<typeof ContentDeleteActionTableNavDevPluginAdmin>) => {
  const t = useTranslations('admin.core.plugins.dev.nav.delete');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();
  const { pluginCode } = useDevPluginAdmin();

  const onSubmit = async () => {
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
