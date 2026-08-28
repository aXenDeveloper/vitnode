"use client";

import { NextAuthLink } from "../../next-link";
import { mutationApi } from "./mutation-api.server";
import { SignInFormContent } from "./sign-in-form-content";

/**
 * {@link SignInFormContent}, wired to Next.js.
 *
 * The props are unchanged, so the AdminCP sign-in screen sees exactly the
 * component it always did. This supplies the two things the shared form cannot
 * resolve for itself:
 *
 * - **The mutation.** A server action that signs in, revalidates the layout the
 *   session is rendered into and redirects - all three of which are Next.js
 *   APIs, and all three of which stay on this side of the boundary. `isAdmin`
 *   travels with it because the mutation is the only thing that ever cared:
 *   it decides which layout to revalidate and where to land.
 * - **A `Link`** that knows how to write a locale prefix into an internal href.
 *   `/login/reset-password` is not migrated in this stage and is not touched
 *   here.
 */
export const FormSignIn = ({
  isAdmin,
  isEmail,
}: {
  isAdmin?: boolean;
  isEmail: boolean;
}) => (
  <SignInFormContent
    LinkComponent={NextAuthLink}
    onSignIn={async values => await mutationApi({ ...values, isAdmin })}
    showResetPassword={isEmail}
  />
);
