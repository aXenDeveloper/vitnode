import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ContentDeleteActionTableNavAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useDeleteNavAdmin = ({
  id,
  name,
}: Pick<
  React.ComponentProps<typeof ContentDeleteActionTableNavAdmin>,
  'id' | 'name'
>) => {
  const t = useTranslations('admin.core.styles.nav.delete');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useAlertDialog();
  const { convertText } = useTextLang();

  const onSubmit = async () => {
    try {
      await mutationApi(id);
      toast.success(t('success'), {
        description: convertText(name),
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
