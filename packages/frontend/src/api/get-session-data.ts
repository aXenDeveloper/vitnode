import { ShowAuthObj } from 'vitnode-shared/auth.dto';

import { fetcher } from './fetcher';
import { getUserIdCookie } from './get-user-id-cookie';
import { RevalidateTagEnum } from './revalidate-tags';

export const getSessionData = async () => {
  const userIdFromCookie = await getUserIdCookie();

  const { data } = await fetcher<ShowAuthObj>({
    url: '/core/auth',
    cache: 'force-cache',
    next: {
      tags: [
        userIdFromCookie
          ? `${RevalidateTagEnum.Core_Session}--${userIdFromCookie}`
          : RevalidateTagEnum.Core_Session,
      ],
    },
  });

  return data;
};
