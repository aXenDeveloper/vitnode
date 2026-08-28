"use client";

import { Link } from "@/lib/navigation";

import type { UserHeaderLinkProps, UserHeaderUser } from "./user-header-model";

import { logOutMutationApi } from "./auth/log-out-mutation-api.server";
import { UserHeaderContent } from "./user-header-content";

/**
 * {@link UserHeaderContent}, wired to Next.js.
 *
 * The only place Next.js enters the user header: `next-intl`'s locale-aware
 * `Link`, and the `"use server"` sign-out. Everything visible is the shared
 * component's.
 *
 * A client component, and it has to be one - a component type such as
 * `LinkComponent` cannot cross the server/client boundary as a prop, so the
 * choice of link is made here rather than in the Server Component above. The
 * session does cross it, as plain data.
 */

/**
 * The user header's link, the Next.js way.
 *
 * Module scope rather than inline, so the component type is stable across
 * renders and the menu items are not remounted on every one of them. Every prop
 * is forwarded, `ref` included: Base UI's `render` clones this element with the
 * class name and ref the menu item needs.
 */
const NextUserHeaderLink = ({
  children,
  href,
  ...props
}: UserHeaderLinkProps) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

/**
 * Signing out of the main site.
 *
 * `logOutMutationApi` is the same server action the AdminCP sidebar calls with
 * `isAdmin: true`; here the site session is the one being ended, so the
 * revalidation and the redirect it performs are the main layout's.
 */
const onSignOut = async () => {
  await logOutMutationApi({});
};

export const NextUserHeader = ({ user }: { user: null | UserHeaderUser }) => (
  <UserHeaderContent
    LinkComponent={NextUserHeaderLink}
    onSignOut={onSignOut}
    state={user ? { status: "authenticated", user } : { status: "anonymous" }}
  />
);
