"use client";

import { Link, usePathname } from "@/lib/navigation";

import type { NavAdminParent } from "./nav-model";

import { NavSidebarAdminContent } from "./nav-content";

export type { NavAdminParent } from "./nav-model";

/**
 * {@link NavSidebarAdminContent}, wired to Next.js.
 *
 * A client component only because `usePathname` is one. The navigation itself is
 * resolved on the server by `getAdminNav` and handed down as a prop, so no
 * permission check and no session read crosses this boundary.
 */
export const NavSidebarAdmin = ({ nav }: { nav: NavAdminParent[] }) => {
  const pathname = usePathname();

  return (
    <NavSidebarAdminContent
      LinkComponent={Link}
      nav={nav}
      pathname={pathname}
    />
  );
};
