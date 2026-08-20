"use server";

import type { z } from "zod";

import type { zodSignUpSchema } from "@/api/modules/users/routes/sign-up.route";

import { usersModule } from "@/api/modules/users/users.module";
import { expireCachePath } from "@/framework/cache";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const mutationApi = async ({
  captchaToken,
  ...input
}: z.infer<typeof zodSignUpSchema> & { captchaToken: string }) => {
  const res = await fetcher(usersModule, {
    path: "/sign_up",
    method: "post",
    module: "users",
    allowSaveCookies: true,
    captchaToken,
    args: {
      body: input,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  const data = await res.json();
  if (data.emailVerified) {
    expireCachePath("/[locale]/(main)", "layout");
    await redirect("/");
  }

  return { data };
};
