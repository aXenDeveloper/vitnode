import 'server-only';
import { cookies } from 'next/headers';

import { cookieFromStringToObject } from './cookie-from-string-to-object';

export const handleSetCookiesFetcher = async (res: Response) => {
  await Promise.all(
    cookieFromStringToObject(res.headers.getSetCookie()).map(async cookie => {
      const key = Object.keys(cookie)[0];
      const value = Object.values(cookie)[0];

      if (typeof value !== 'string' || typeof key !== 'string') return;

      (await cookies()).set(key, value, {
        domain: cookie.Domain,
        path: cookie.Path,
        expires: new Date(cookie.Expires),
        secure: cookie.Secure,
        httpOnly: cookie.HttpOnly,
        sameSite: cookie.SameSite,
      });
    }),
  );
};
