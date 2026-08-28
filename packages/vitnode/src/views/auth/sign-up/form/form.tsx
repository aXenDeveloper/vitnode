"use client";

import type { z } from "zod";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { NextAuthLink } from "../../next-link";
import { mutationApi } from "./mutation-api.server";
import { SignUpFormContent } from "./sign-up-form-content";

/**
 * {@link SignUpFormContent}, wired to Next.js.
 *
 * The props are unchanged, so `SignUpView` sees exactly the component it always
 * did. This supplies the two things the shared form cannot resolve for itself:
 *
 * - **The mutation.** A server action that creates the account, keeps the
 *   session cookie the API may have minted, revalidates the layout the session
 *   is rendered into and redirects - all of which are Next.js APIs, and all of
 *   which stay on this side of the boundary.
 * - **A `Link`** that knows how to write a locale prefix into an internal href,
 *   for the terms-and-conditions link inside the checkbox description.
 */
export const FormSignUp = ({
  captcha,
  isEmail,
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];
  isEmail: boolean;
}) => (
  <SignUpFormContent
    captcha={captcha}
    isEmail={isEmail}
    LinkComponent={NextAuthLink}
    onSignUp={mutationApi}
  />
);
