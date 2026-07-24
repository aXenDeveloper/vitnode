"use server";

import { revalidatePath } from "next/cache";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import { fetcher } from "@/lib/fetcher";

export const deleteFileAction = async ({
  id,
}: {
  id: number;
}): Promise<{ data?: true; error?: { status: number } }> => {
  const res = await fetcher(filesAdminModule, {
    path: "/{id}",
    method: "delete",
    module: "files",
    prefixPath: "/admin",
    args: {
      params: { id: String(id) },
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/admin", "layout");

  return { data: true };
};
