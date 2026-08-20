"use server";

import { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import { expireCachePath } from "@/framework/cache";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async (id: number) => {
  const res = await fetcher(cronAdminModule, {
    path: "/{id}",
    method: "post",
    module: "cron",
    prefixPath: "/admin/advanced",
    args: {
      params: { id: id.toString() },
    },
  });

  if (!res.ok) {
    return { error: "Failed to run cron job" };
  }

  expireCachePath(
    "[locale]/admin/(auth)/(plugins)/(vitnode-core)/core/advanced/cron",
  );
};
