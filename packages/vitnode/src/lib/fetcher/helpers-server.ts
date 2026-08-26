import "server-only";
import { cookies } from "next/headers";

import { parseSetCookies } from "./set-cookie";

export const handleSetCookiesFetcher = async (res: Response) => {
  const store = await cookies();

  for (const { name, options, value } of parseSetCookies(
    res.headers.getSetCookie(),
  )) {
    store.set(name, value, options);
  }
};
