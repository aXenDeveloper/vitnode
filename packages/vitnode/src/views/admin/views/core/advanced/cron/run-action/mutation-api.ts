"use server";

import { revalidatePath } from "next/cache";

import { cronAdminModuleApi } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async (id: number) => {
  const res = await fetcher(cronAdminModuleApi, {
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

  revalidatePath(
    "[locale]/admin/(auth)/(plugins)/(vitnode-core)/core/advanced/cron",
  );
};
