"use server";

import type { z } from "zod";

import { revalidatePath } from "next/cache";

import type { zodSignInSchema } from "@/api/modules/users/routes/sign-in.route";

import { usersModule } from "@/api/modules/users/users.module";
import { ADMIN_HOME_PATH, sanitizeAdminRedirect } from "@/lib/admin-redirect";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const mutationApi = async ({
  redirectTo,
  ...input
}: z.infer<typeof zodSignInSchema> & {
  isAdmin?: boolean;
  redirectTo?: string;
}) => {
  const res = await fetcher(usersModule, {
    path: "/sign_in",
    method: "post",
    module: "users",
    allowSaveCookies: true,
    args: {
      body: input,
    },
  });

  if (res.status === 403) {
    return { message: "access_denied" } as const;
  }

  if (res.status !== 201) {
    return { message: "Internal Server Error" } as const;
  }

  if (input.isAdmin) {
    revalidatePath("/[locale]/admin", "layout");
    // `redirectTo` crossed the network as part of the form payload, so it is
    // sanitised again here rather than trusted from the page that rendered it.
    await redirect(sanitizeAdminRedirect(redirectTo) ?? ADMIN_HOME_PATH);

    return;
  }

  revalidatePath("/[locale]/(main)", "layout");
  await redirect("/");
};
