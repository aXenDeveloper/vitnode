"use server";

import { revalidatePath } from "next/cache";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async (nameCode: string) => {
  const res = await fetcher(adminModule, {
    path: "/{nameCode}/verify-email",
    method: "post",
    module: "admin/users",
    args: {
      params: { nameCode },
    },
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};
