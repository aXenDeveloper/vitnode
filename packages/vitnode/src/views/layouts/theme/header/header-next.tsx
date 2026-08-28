"use client";

import { Link } from "@/lib/navigation";

import type { HeaderLayoutContentProps } from "./header-content";
import type { HeaderLinkProps } from "./header-nav";

import { HeaderLayoutContent } from "./header-content";

/**
 * The header's links, the Next.js way: `next-intl`'s locale-aware `Link`.
 *
 * One module-scope component rather than one per link, so the logo and both nav
 * items render the same component type and React reconciles the header instead
 * of remounting it.
 */
export const NextHeaderLink = ({
  children,
  href,
  ...props
}: HeaderLinkProps) => (
  <Link href={href} {...props}>
    {children}
  </Link>
);

/**
 * {@link HeaderLayoutContent}, wired to Next.js.
 *
 * A client component whose only job is to choose the link, because a component
 * type cannot cross the server/client boundary as a prop - `header.tsx` is an
 * async Server Component, so the choice has to be made on this side. Everything
 * it reads a request for (the logo, the user slot, the translated nav) arrives as
 * props: elements and plain data, both of which do cross.
 */
export const NextHeaderContent = (
  props: Omit<HeaderLayoutContentProps, "LinkComponent">,
) => <HeaderLayoutContent {...props} LinkComponent={NextHeaderLink} />;
