import { buildPlugin } from 'vitnode/lib/plugin';

import { configPlugin } from './config';
import { Test } from './views/test';

export const blogPlugin = () => {
  return buildPlugin({
    ...configPlugin,
    pages: () => {
      return <Test />;
    },
  });
};
