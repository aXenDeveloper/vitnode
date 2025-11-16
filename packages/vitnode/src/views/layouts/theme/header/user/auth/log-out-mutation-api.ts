"use server";

import { revalidatePath } from "next/cache";

import { usersModuleApi } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const logOutMutationApi = async ({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) => {
  const res = await fetcher(usersModuleApi, {
    path: "/sign_out",
    method: "delete",
    allowSaveCookies: true,
    module: "users",
    args: {
      body: { isAdmin },
    },
  });

  if (res.status === 200) {
    if (isAdmin) {
      revalidatePath("/admin/(main)", "layout");
      await redirect("/admin");

      return;
    }
    revalidatePath("/[locale]/(main)", "layout");
    await redirect("/");
  }
};
