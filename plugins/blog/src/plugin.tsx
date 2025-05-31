import { buildPlugin } from '@vitnode/core/lib/plugin';

import { configPlugin } from './config';

export const blogPlugin = () => {
  return buildPlugin({
    ...configPlugin,
    adminNav: [
      {
        label: 'Blog',
      },
    ],
  });
};
