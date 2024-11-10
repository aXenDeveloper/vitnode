import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

import { mutationEditApi } from '../../../../actions/create/hooks/mutation-edit-api';

export const useSetDefaultPluginAdmin = (data: ShowPluginAdmin) => {
  const tCore = useTranslations('core.global.errors');

  const onSubmit = async () => {
    try {
      await mutationEditApi({
        ...data,
        description: data.description ?? '',
        author_url: data.author_url ?? '',
        default: true,
      });
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });

      return;
    }
  };

  return {
    onSubmit,
  };
};
