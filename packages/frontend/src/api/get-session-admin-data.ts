import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { fetcher } from './fetcher';
import { getAdminIdCookie } from './get-user-id-cookie';
import { RevalidateTagEnum } from './revalidate-tags';

export const getSessionAdminData = async () => {
  const adminIdFromCookie = await getAdminIdCookie();

  const { data } = await fetcher<ShowAuthAdminObj>({
    url: '/admin/auth',
    cache: 'force-cache',
    next: {
      tags: [
        adminIdFromCookie
          ? `${RevalidateTagEnum.Admin_Core_Sessions}--${adminIdFromCookie}`
          : RevalidateTagEnum.Admin_Core_Sessions,
      ],
    },
  });

  return data;
};
