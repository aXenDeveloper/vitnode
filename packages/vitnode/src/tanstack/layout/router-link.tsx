"use client";

import { Link } from "@tanstack/react-router";

import type { AuthLinkProps } from "@/views/auth/auth-link";

/**
 * The router's own `Link`, in the shape every shared VitNode view asks for.
 *
 * The shared views take a `LinkComponent` because turning `/settings` into a
 * navigation is the one question whose answer differs between frameworks. This
 * is the plain TanStack Router answer, and it is what the components in this
 * namespace fall back to when a host does not pass one.
 *
 * A host *should* pass one while it is mid-migration: with half of VitNode still
 * served by a Next.js application, a link to a route this router does not own
 * has to be a document navigation into the app that does, and only the host
 * knows where that is. Handing every internal-looking path to `<Link>` turns a
 * perfectly good page into a not-found. That wrapper is deliberately not here -
 * it exists only until the cutover, and a package that shipped one would outlive
 * the reason for it.
 *
 * `href` in, `to` out, and nothing else: the rest of the anchor's props - the
 * class name, the children, the ref a Base UI `render` clones onto it - pass
 * straight through, which is the whole reason {@link AuthLinkProps} is the
 * shared shape rather than `{ href }`.
 */
export const RouterLink = ({ children, href, ...props }: AuthLinkProps) => (
  <Link {...props} to={href}>
    {children}
  </Link>
);
