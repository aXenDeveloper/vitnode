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
 * A host passes its own only when it has a reason to - an application that
 * mounts VitNode under a path prefix, or one that wants a link decorated. The
 * default is correct for an ordinary install, which is why most call sites here
 * omit the prop entirely.
 *
 * One case it deliberately does *not* handle: an href that names another origin.
 * `<Link to="https://status.example.com">` asks the router to match an absolute
 * URL against a route tree, which answers with something broken rather than with
 * the site the href named. A plugin's `admin.nav` entry may legitimately point
 * at one, so the AdminCP classifies before it renders - see `adminLinkFor` in
 * `views/admin/layouts/admin-link`. A `LinkComponent` takes a *path*, in every
 * framework, and that stays true here.
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
