"use server";

import { usersModuleApi } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async ({
  email,
  captchaToken,
}: {
  captchaToken: string;
  email: string;
}) => {
  const res = await fetcher(usersModuleApi, {
    module: "users",
    path: "/reset-password",
    method: "post",
    captchaToken,
    args: {
      body: { email },
    },
  });

  if (res.status !== 201) {
    return { error: "internal_server_error" };
  }
};
