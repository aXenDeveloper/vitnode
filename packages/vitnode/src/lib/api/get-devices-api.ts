import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const getDevicesApi = async () => {
  const res = await fetcher(usersModule, {
    path: "/devices",
    method: "get",
    module: "users",
  });

  const data = await res.json();

  return data;
};

export type DevicesApi = Awaited<ReturnType<typeof getDevicesApi>>;
