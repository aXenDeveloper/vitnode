import "@tanstack/react-start/server-only";

import { adminModule } from "@/api/modules/admin/admin.module";

import { fetcher } from "../../fetcher/server";

export const fetchDashboardLayoutOnServer = async () => {
  const response = await fetcher(adminModule, {
    method: "get",
    module: "admin/dashboard",
    path: "/",
  });

  if (!response.ok) return [];

  return (await response.json()).widgets;
};
