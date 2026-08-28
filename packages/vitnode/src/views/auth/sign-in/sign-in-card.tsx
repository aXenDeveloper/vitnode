"use client";

import { NextAuthLink } from "../next-link";
import { SignInContent } from "./sign-in-content";

/**
 * {@link SignInContent}, wired to Next.js.
 *
 * A client component with two slots, and that shape is load bearing. The card
 * itself has to be one - it reads its strings from the client context that
 * `I18nProvider` mounts, and a component type such as `LinkComponent` cannot
 * cross the server/client boundary as a prop, so the choice of link is made
 * here rather than passed in from the page.
 *
 * `form` and `sso` still arrive as *elements*, which do cross it: they are the
 * Server Components that read the deployment configuration, each already
 * wrapped in its own `<Suspense>` by `SignInView`. So the card renders in the
 * browser while the two things that need a request keep streaming in from the
 * server, exactly as they did before.
 *
 * The "create an account" link points at `/register`, which is served by both
 * applications now. This wrapper is the Next.js one, so it links to the Next.js
 * page as it always has; the TanStack Start route hands `SignInContent` its own
 * link component instead. See `AUTH_HREF` in `../auth-link.ts`.
 */
export const SignInCard = ({
  form,
  sso,
}: {
  form: React.ReactNode;
  sso?: React.ReactNode;
}) => <SignInContent form={form} LinkComponent={NextAuthLink} sso={sso} />;
