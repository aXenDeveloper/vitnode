import { fetcherNew } from 'vitnode/lib/fetcher-new';

export const test = async () => {
  const client = await fetcherNew({
    plugin: 'core',
    module: 'middleware',
    options: {
      cache: 'force-cache',
    },
  });
};
