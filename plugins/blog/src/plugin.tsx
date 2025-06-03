import { buildPlugin } from '@vitnode/core/lib/plugin';
import { ListIcon } from 'lucide-react';

import { configPlugin } from './config';

export const blogPlugin = () => {
  return buildPlugin({
    ...configPlugin,
    admin: {
      nav: [
        {
          id: 'categories',
          href: '/admin/blog/categories',
          icon: <ListIcon />,
        },
      ],
    },
  });
};
