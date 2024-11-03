import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { queryApi } from './query-api';

export const useSearchAdminApi = (search: string) => {
  const t = useTranslations('core.global.errors');
  const query = useQuery({
    queryKey: ['admin__sessions__search', { search }],
    queryFn: async () => {
      try {
        const mutation = await queryApi({ search });

        return mutation.data;
      } catch (_) {
        toast.error(t('title'), {
          description: t('internal_server_error'),
        });
      }
    },
    enabled: search.length >= 3 || search.length === 0,
  });

  return query;
};
