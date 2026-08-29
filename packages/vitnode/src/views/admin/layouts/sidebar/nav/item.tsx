"use client";

import { Link, usePathname } from "@/lib/navigation";

import type { ItemNavAdminContentProps } from "./item-content";

import { ItemNavAdminContent } from "./item-content";

/**
 * {@link ItemNavAdminContent}, wired to Next.js.
 *
 * The two answers only this framework can give: `next-intl`'s locale-aware
 * `Link` and the pathname from `usePathname`. Everything the entry actually
 * *does* - the active rule, the collapsible, closing the drawer on a phone - is
 * in the shared component, which the TanStack AdminCP renders with the router's
 * answers instead.
 */
export type ItemNavAdminProps = Omit<
  ItemNavAdminContentProps,
  "LinkComponent" | "pathname"
>;

export const ItemNavAdmin = (props: ItemNavAdminProps) => {
  const pathname = usePathname();

  return (
    <ItemNavAdminContent {...props} LinkComponent={Link} pathname={pathname} />
  );
};
