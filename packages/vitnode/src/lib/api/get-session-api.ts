import { usersModuleApi } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const getSessionApi = async () => {
  const res = await fetcher(usersModuleApi, {
    path: "/session",
    method: "get",
    module: "users",
    options: {
      cache: "force-cache",
    },
  });

  const data = await res.json();

  return data;
};

export type SessionApi = Awaited<ReturnType<typeof getSessionApi>>;
