import { AdminTypes } from '@/api/modules/admin/admin.module';

import { fetcher } from '../fetcher';
import { redirect } from '../navigation';

export const getSessionAdminApi = async () => {
  const client = await fetcher<AdminTypes>({
    plugin: 'core',
    module: 'admin',
    options: {
      cache: 'force-cache',
    },
  });

  const res = await client.session.$get();
  if (res.status !== 200) {
    await redirect('/admin');

    return;
  }
  const data = await res.json();

  return data;
};
