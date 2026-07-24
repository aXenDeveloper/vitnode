"use server";

import { revalidatePath } from "next/cache";

import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";

export const clearCacheMutation = async () => {
  const canClearCache = await checkAdminPermissionApi({
    module: "debug",
    permission: "can_clear_cache",
  });

  if (!canClearCache) {
    throw new Error("Forbidden");
  }

  await Promise.resolve(revalidatePath("/", "layout"));
};
