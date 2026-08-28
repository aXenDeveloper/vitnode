"use server";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

import type {
  PasswordResetMutationResult,
  PasswordResetSubmitValues,
} from "./schema";

/**
 * Asking the API for a reset link, for Next.js.
 *
 * `201` is the only success the route declares, and it is what a *good* request
 * gets whether or not the address belongs to an account - the API decides that
 * on its own side and says nothing about it. So there is nothing to inspect
 * here beyond "did it get through", and nothing this layer could reveal even if
 * it wanted to.
 *
 * No `allowSaveCookies`: this route mints no session, and copying whatever
 * cookies a reply happened to carry is not something to do by default.
 */
export const mutationApi = async ({
  captchaToken,
  email,
}: PasswordResetSubmitValues): Promise<PasswordResetMutationResult> => {
  const res = await fetcher(usersModule, {
    module: "users",
    path: "/reset-password",
    method: "post",
    captchaToken,
    args: {
      body: { email },
    },
  });

  if (res.status !== 201) return { message: "Internal Server Error" };

  return undefined;
};
