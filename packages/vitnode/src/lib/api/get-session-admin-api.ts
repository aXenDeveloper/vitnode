import { adminModule } from '@/api/modules/admin/admin.module';
import { fetcher } from '@/lib/fetcher';

import { redirect } from '../navigation';

export const getSessionAdminApi = async () => {
  const res = await fetcher(adminModule, {
    path: '/session',
    method: 'get',
    module: 'admin',
  });

  if (res.status !== 200) {
    await redirect('/admin');

    return;
  }
  const data = await res.json();

  return data;
};
