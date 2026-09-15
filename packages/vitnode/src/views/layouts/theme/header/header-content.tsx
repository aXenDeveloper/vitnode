import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import type { HeaderNavItem } from "./header-nav";

import { HEADER_HREF } from "./header-nav";
import { HeaderNavMenu } from "./header-nav-menu";

export interface HeaderLayoutContentProps extends Omit<
  React.ComponentProps<"header">,
  "children"
> {
  logo: React.ReactNode;
  navigation: HeaderNavItem[];
  user?: React.ReactNode;
}

export const HeaderLayoutContent = ({
  className,
  logo,
  navigation,
  user,
  ...props
}: HeaderLayoutContentProps) => (
  <header
    className={cn("sticky top-0 z-20 w-full sm:top-2 sm:mt-2", className)}
    {...props}
  >
    <div className="dark:bg-background/75 bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm">
      <Link to={HEADER_HREF.home}>{logo}</Link>

      <HeaderNavMenu className="ms-4" navigation={navigation} />

      <div className="ml-auto flex items-center gap-2">{user}</div>
    </div>
  </header>
);
