import "@tanstack/react-start/server-only";

import { usersModule } from "@/api/modules/users/users.module";
import { DevicesRequestError } from "@/views/auth/settings/devices/devices-query";

import { fetcher } from "../fetcher/server";

export const fetchDevicesOnServer = async () => {
  const response = await fetcher(usersModule, {
    method: "get",
    module: "users",
    path: "/devices",
  });

  if (!response.ok) throw new DevicesRequestError(response.status);

  return await response.json();
};
