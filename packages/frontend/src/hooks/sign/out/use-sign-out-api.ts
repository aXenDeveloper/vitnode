import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationApi } from './mutation-api';

export const useSignOutApi = () => {
  const t = useTranslations('core.global.errors');

  const onSubmit = async () => {
    try {
      await mutationApi();
    } catch (e) {
      const { message } = e as Error;
      if (message === 'NEXT_REDIRECT') return;
      toast.error(t('title'), {
        description: t('internal_server_error'),
      });
    }
  };

  return {
    onSubmit,
  };
};
