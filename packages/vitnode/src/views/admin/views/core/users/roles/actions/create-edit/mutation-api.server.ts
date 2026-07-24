"use server";

import type { z } from "zod";

import { revalidatePath } from "next/cache";

import type { zodCreateRoleAdminSchema } from "@/api/modules/admin/roles/routes/create.route";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export const createRole = async (
  body: z.infer<typeof zodCreateRoleAdminSchema>,
) => {
  const res = await fetcher(adminModule, {
    path: "/create",
    method: "post",
    module: "admin/roles",
    args: {
      body,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  revalidatePath("/[locale]/admin", "layout");
};

export const editRole = async ({
  id,
  ...body
}: z.infer<typeof zodCreateRoleAdminSchema> & { id: number }) => {
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "patch",
    module: "admin/roles",
    args: {
      params: { id: id.toString() },
      body,
    },
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  revalidatePath("/[locale]/admin", "layout");
};
