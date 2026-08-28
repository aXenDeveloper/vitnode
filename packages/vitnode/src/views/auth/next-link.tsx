"use client";

import { Link } from "@/lib/navigation";

import type { AuthLinkProps } from "./auth-link";

/**
 * The auth screens' link, the Next.js way: `next-intl`'s locale-aware `Link`.
 *
 * One module rather than one per screen, so the login card, the reset-password
 * field and the SSO callback all render the same component type - and so there
 * is a single place where Next.js navigation enters the auth views at all.
 */
export const NextAuthLink = ({ children, href, ...props }: AuthLinkProps) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);
