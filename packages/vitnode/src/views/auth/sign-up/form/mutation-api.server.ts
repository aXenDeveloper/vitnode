"use server";

import { revalidatePath } from "next/cache";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcher } from "@/lib/fetcher";
import { redirect } from "@/lib/navigation";

import type { SignUpMutationResult, SignUpSubmitValues } from "./schema";

import { signUpConflictReason } from "./schema";

/**
 * Registration for Next.js: create the account, then either land the visitor on
 * the front page or hand the form back the reason it could not.
 *
 * `allowSaveCookies: true` is load bearing. On a deployment with no email
 * adapter the API marks the account verified and mints a session on the *same*
 * `201`, so the reply carries a `Set-Cookie` the browser has to keep - without
 * it the visitor is registered and immediately anonymous.
 *
 * The answer is narrowed to {@link SignUpMutationResult} here rather than in the
 * form: this is the only layer that sees the API's body, and the 409 message it
 * writes (`"Email already exists"`) is an internal string that must not reach a
 * screen.
 */
export const mutationApi = async ({
  captchaToken,
  ...input
}: SignUpSubmitValues): Promise<SignUpMutationResult> => {
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

  if (res.status === 409) {
    const conflict = signUpConflictReason(await res.text());

    return {
      message: conflict === "unknown" ? "Internal Server Error" : conflict,
    };
  }

  if (res.status !== 201) return { message: "Internal Server Error" };

  const data = await res.json();

  if (!data.emailVerified) return { emailConfirmation: data.email };

  revalidatePath("/[locale]/(main)", "layout");
  await redirect("/");

  // `redirect()` throws, so this is unreachable - it exists so the function's
  // type is the closed union the shared form reads rather than
  // `... | undefined` inferred from a fall-through.
  return undefined;
};
