"use server";

import type { z } from "zod";

import { revalidatePath } from "next/cache";

import type { zodCreateUserAdminSchema } from "@/api/modules/admin/users/routes/create.route";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async (
  input: z.infer<typeof zodCreateUserAdminSchema>,
) => {
  const res = await fetcher(adminModule, {
    path: "/create",
    method: "post",
    module: "admin/users",
    args: {
      body: input,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  const data = await res.json();
  revalidatePath("/[locale]/admin", "layout");

  return { data };
};
