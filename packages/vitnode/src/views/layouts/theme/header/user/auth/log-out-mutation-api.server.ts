"use server";

import { usersModule } from "@/api/modules/users/users.module";
import { expireCachePath } from "@/framework/cache";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const logOutMutationApi = async ({
  isAdmin = false,
}: {
  isAdmin?: boolean;
}) => {
  const res = await fetcher(usersModule, {
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
      expireCachePath("/admin/(main)", "layout");
      await redirect("/admin");

      return;
    }
    expireCachePath("/[locale]/(main)", "layout");
    await redirect("/");
  }
};
