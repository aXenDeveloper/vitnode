"use server";

import { revalidatePath } from "next/cache";

import { userFilesModule } from "@/api/modules/users/files/files.module";
import { fetcher } from "@/lib/fetcher";

export const deleteMyFileAction = async ({
  id,
}: {
  id: number;
}): Promise<{ data?: true; error?: { status: number } }> => {
  const res = await fetcher(userFilesModule, {
    path: "/{id}",
    method: "delete",
    module: "files",
    prefixPath: "/users",
    args: {
      params: { id: String(id) },
    },
  });

  if (res.status !== 200) {
    return { error: { status: res.status } };
  }

  revalidatePath("/[locale]/(main)", "layout");

  return { data: true };
};
