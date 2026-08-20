"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { expireCachePath } from "@/framework/cache";
import { fetcher } from "@/lib/fetcher";

type MutationResult =
  | { data: { email: string; id: number; name: string; nameCode: string } }
  | { error: { status: number } };

export const mutationApi = async (
  id: number,
  input: { email?: string; name?: string; nameCode?: string },
): Promise<MutationResult> => {
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "patch",
    module: "admin/users",
    args: {
      params: { id: String(id) },
      body: input,
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  const data = await res.json();
  expireCachePath("/[locale]/admin", "layout");

  return { data };
};
