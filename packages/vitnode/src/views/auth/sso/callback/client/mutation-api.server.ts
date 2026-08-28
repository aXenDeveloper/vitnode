"use server";

import { revalidatePath } from "next/cache";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

import type { SSOCallbackResult } from "../sso-callback-result";

import { ssoCallbackResultFromStatus } from "../sso-callback-result";

export const mutationApi = async ({
  code,
  providerId,
  state,
}: {
  code: string;
  providerId: string;
  state: string;
}): Promise<SSOCallbackResult> => {
  const res = await fetcher(usersModule, {
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

  const result = ssoCallbackResultFromStatus(res.status);

  if (!result?.failure) {
    revalidatePath("/[locale]/(main)", "layout");
  }

  return result;
};
