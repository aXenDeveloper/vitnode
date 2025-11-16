"use server";

import { usersModuleApi } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

export const mutationApi = async (providerId: string) => {
  const res = await fetcher(usersModuleApi, {
    path: "/{providerId}",
    method: "post",
    module: "users/sso",
    args: {
      params: {
        providerId,
      },
    },
    allowSaveCookies: true,
  });

  if (res.status !== 200) {
    return { message: "Something is wrong" };
  }

  const data = (await res.json()) as { url: string };
  await redirect(data.url);
};
