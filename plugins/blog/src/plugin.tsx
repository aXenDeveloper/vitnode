import { buildPlugin } from 'vitnode/lib/plugin';

import { configPlugin } from './config';

export const blogPlugin = () => {
  return buildPlugin({
    ...configPlugin,
    pages: {
      component: ({ params }) => {
        if (params[0] === 'blog' && !params[1]) {
          return <div className="container mx-auto p-4">Page Blog plugin</div>;
        }
      },
    },
  });
};
