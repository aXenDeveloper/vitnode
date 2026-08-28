"use server";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";

import type {
  ChangePasswordMutationResult,
  ChangePasswordSubmitValues,
} from "./schema";

/**
 * Setting a new password from a recovery link, for Next.js.
 *
 * `400` is kept apart from everything else: it is the API's answer when the
 * `userId` + `token` + unexpired-`expiresAt` lookup finds nothing, which means
 * the link is wrong, spent or older than thirty minutes. The API's own message
 * stays on the server; only the literal travels.
 *
 * No `allowSaveCookies` and no revalidation, because the API mints no session
 * here - the visitor is still signed out, and the form sends them to the login
 * page.
 */
export const mutationApi = async ({
  password,
  token,
  userId,
}: ChangePasswordSubmitValues): Promise<ChangePasswordMutationResult> => {
  const res = await fetcher(usersModule, {
    module: "users",
    path: "/change-password",
    method: "post",
    args: {
      body: { password, token, userId },
    },
  });

  if (res.status === 400) return { message: "invalid_token" };
  if (res.status !== 201) return { message: "internal_server_error" };

  return undefined;
};
