import { buildPlugin } from '@vitnode/core/lib/plugin';
import { ListIcon } from 'lucide-react';

import { CONFIG_PLUGIN } from '@/config';

export const blogPlugin = () => {
  return buildPlugin({
    ...CONFIG_PLUGIN,
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
