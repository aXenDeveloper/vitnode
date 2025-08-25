"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import type { zodSignInSchema } from "@/api/modules/users/routes/sign-in.route";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const mutationApi = async (
  input: z.infer<typeof zodSignInSchema> & {
    isAdmin?: boolean;
  },
) => {
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
    await redirect("/admin/core");

    return;
  }

  revalidatePath("/[locale]/(main)", "layout");
  await redirect("/");
};
