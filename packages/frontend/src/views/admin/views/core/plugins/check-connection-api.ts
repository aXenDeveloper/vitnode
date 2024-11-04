import { fetcher } from '@/api/fetcher';

export const checkConnectionApi = async () => {
  const startTime = Date.now();

  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        await fetcher<object>({
          url: '/admin/plugins',
        });

        clearInterval(interval);
        resolve();
      } catch (_) {
        /* empty */
      }

      if (Date.now() - startTime > 10000) {
        clearInterval(interval);
        reject(new Error('Connection check timed out'));
      }
    }, 1000);
  });
};
