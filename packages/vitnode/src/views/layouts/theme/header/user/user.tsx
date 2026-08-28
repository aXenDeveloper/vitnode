import { getSessionApi } from "@/lib/api/get-session-api";

import { NextUserHeader } from "./next-user-header";

/**
 * The user area of the main header, in the Next.js app.
 *
 * A Server Component whose whole job is the session: it is `await`ed here, once,
 * and handed down as data. `getSessionApi()` is wrapped in React's `cache()`, so
 * the layout, this header and the page share one round trip - and there is
 * deliberately no second read further down, which is what the old
 * `AuthUserHeader` did.
 *
 * Everything rendered is {@link NextUserHeader}'s, and everything *visible* is
 * the shared `UserHeaderContent`'s. `HeaderLayout` wraps this in a `<Suspense>`
 * whose fallback is that component's own `UserHeaderSkeleton`, so the header
 * reserves the right width before the session arrives.
 */
export const UserHeader = async () => {
  const { user } = await getSessionApi();

  return <NextUserHeader user={user} />;
};
