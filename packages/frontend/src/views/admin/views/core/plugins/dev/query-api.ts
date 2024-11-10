import { fetcher } from '@/api/fetcher';
import { notFound } from 'next/navigation';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

export const getPluginDataAdmin = async (code: string) => {
  try {
    const { data } = await fetcher<ShowPluginAdmin>({
      url: `/admin/plugins/${code}`,
    });

    return data;
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('404')) {
      notFound();
    }

    throw error;
  }
};
