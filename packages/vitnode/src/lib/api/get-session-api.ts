import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const getSessionApi = async () => {
  const res = await fetcher(usersModule, {
    path: "/session",
    method: "get",
    module: "users",
    options: {
      cache: "force-cache",
    },
  });

  // A non-200 response (e.g. 429 rate limiting) carries a non-session body, so
  // treat it as "no session" rather than crashing while parsing it as JSON.
  if (res.status !== 200) {
    return { user: null };
  }

  const data = await res.json();

  return data;
};

export type SessionApi = Awaited<ReturnType<typeof getSessionApi>>;
