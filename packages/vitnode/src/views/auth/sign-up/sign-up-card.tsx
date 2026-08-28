"use client";

import { NextAuthLink } from "../next-link";
import { SignUpContent } from "./sign-up-content";

/**
 * {@link SignUpContent}, wired to Next.js.
 *
 * A client component with two slots, and that shape is load bearing - the same
 * arrangement `SignInCard` uses. The card itself has to be one: it reads its
 * strings from the client context `I18nProvider` mounts, it owns the
 * confirmation state through `WrapperSignUp`, and a component type such as
 * `LinkComponent` cannot cross the server/client boundary as a prop.
 *
 * `form` and `sso` still arrive as *elements*, which do cross it: they are the
 * Server Components that read the deployment configuration, each already
 * wrapped in its own `<Suspense>` by `SignUpView`.
 */
export const SignUpCard = ({
  form,
  sso,
}: {
  form: React.ReactNode;
  sso?: React.ReactNode;
}) => <SignUpContent form={form} LinkComponent={NextAuthLink} sso={sso} />;
