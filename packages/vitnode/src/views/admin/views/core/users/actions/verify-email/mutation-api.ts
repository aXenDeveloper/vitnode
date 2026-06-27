"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async (id: number) => {
  const res = await fetcher(adminModule, {
    path: "/{id}/verify-email",
    method: "post",
    module: "admin/users",
    args: {
      params: { id: String(id) },
    },
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};
