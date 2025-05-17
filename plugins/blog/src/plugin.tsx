import { buildPlugin } from 'vitnode/lib/plugin';

import { configPlugin } from './config';

export const blogPlugin = () => {
  return buildPlugin({
    ...configPlugin,
  });
};
