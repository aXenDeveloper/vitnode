"use server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { fetcher } from "@/lib/fetcher";

export const rebuildSearchIndexMutation = async () => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/search/rebuild",
    method: "post",
    module: "debug",
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  return { data: await res.json() };
};
