"use server";

import { revalidatePath } from "next/cache";

import { usersModuleApi } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

export const mutationApi = async ({
  code,
  providerId,
  state,
}: {
  code: string;
  providerId: string;
  state: string;
}) => {
  const res = await fetcher(usersModuleApi, {
    path: "/{providerId}/callback",
    method: "get",
    module: "users/sso",
    allowSaveCookies: true,
    args: {
      params: {
        providerId,
      },
      query: {
        code,
        state,
      },
    },
  });

  if (res.status === 409) {
    return { error: "Email already exists" };
  }

  if (res.status !== 200) {
    return { error: "Something went wrong" };
  }

  revalidatePath("/[locale]/(main)", "layout");
};
