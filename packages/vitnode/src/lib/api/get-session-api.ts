import { cache } from "react";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

/**
 * The signed-in visitor, or `{ user: null }`.
 *
 * Wrapped in React's `cache()`, which memoises per **render pass** - not across
 * requests. The layout, the header, the user menu and the page itself all ask
 * for the session while rendering one page, and without this each one is its
 * own HTTP round-trip to the API for a byte-identical answer.
 *
 * Deliberately *not* a Next cache. The response is per-visitor and changes the
 * moment they edit their profile or verify their email, so there is no shared
 * entry to hand out and no safe lifetime to give one: `cache: "force-cache"`
 * here would store the answer under the session cookie and keep serving it long
 * after the user changed. The database round-trip behind it is already cached -
 * see the [Redis session cache](/docs/dev/advanced/redis#session-caching), which
 * is short-lived and cleared on sign-out.
 */
export const getSessionApi = cache(async () => {
  const res = await fetcher(usersModule, {
    path: "/session",
    method: "get",
    module: "users",
  });

  // A non-200 response (e.g. 429 rate limiting) carries a non-session body, so
  // treat it as "no session" rather than crashing while parsing it as JSON.
  if (res.status !== 200) {
    return { user: null };
  }

  const data = await res.json();

  return data;
});

export type SessionApi = Awaited<ReturnType<typeof getSessionApi>>;
