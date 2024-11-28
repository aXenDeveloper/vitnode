import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useDevPluginAdmin } from '../../../../../hooks/use-dev-plugin';
import { PermissionsAdminWithI18n } from '../../../../permissions-admin';
import { mutationApi } from './mutation-api';

export const useDeletePermissionAdminPluginAdmin = ({
  id,
  parentId,
}: Pick<PermissionsAdminWithI18n, 'id'> & {
  parentId: string | undefined;
}) => {
  const t = useTranslations('admin.core.plugins.dev.permissions-admin.delete');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();
  const { pluginCode } = useDevPluginAdmin();

  const onSubmit = async () => {
    try {
      await mutationApi({
        plugin_code: Array.isArray(pluginCode) ? pluginCode[0] : pluginCode,
        id,
        parent_id: parentId,
      });

      setOpen(false);
      toast.success(t('success'), {
        description: id,
      });
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { onSubmit };
};
