import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import type { HeaderNavItem } from "./header-nav";

import { HEADER_HREF } from "./header-nav";
import { HeaderNavMenu, HeaderNavSkeleton } from "./header-nav-menu";

export interface HeaderLayoutContentProps extends Omit<
  React.ComponentProps<"header">,
  "children"
> {
  isNavigationPending?: boolean;
  logo: React.ReactNode;
  mobileUser?: React.ReactNode;
  moreNavigationLabel: string;
  navigation: HeaderNavItem[];
  navigationLoadingLabel: string;
  notifications?: React.ReactNode;
  user?: React.ReactNode;
}

export const HeaderLayoutContent = ({
  className,
  isNavigationPending = false,
  logo,
  mobileUser,
  moreNavigationLabel,
  navigation,
  navigationLoadingLabel,
  notifications,
  user,
  ...props
}: HeaderLayoutContentProps) => (
  <header
    className={cn(
      "sticky top-0 z-20 w-full sm:top-2 sm:mt-2 sm:px-4",
      className,
    )}
    {...props}
  >
    <div className="dark:bg-background/75 bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm">
      <Link to={HEADER_HREF.home}>{logo}</Link>

      {isNavigationPending ? (
        <HeaderNavSkeleton className="ms-4" label={navigationLoadingLabel} />
      ) : (
        <HeaderNavMenu
          className="ms-4"
          moreLabel={moreNavigationLabel}
          navigation={navigation}
        />
      )}

      <div className="ms-auto flex shrink-0 items-center gap-2">
        {notifications}
        <div
          className={cn(
            "flex items-center gap-2",
            mobileUser !== undefined && "max-sm:hidden",
          )}
        >
          {user}
        </div>
        {mobileUser === undefined ? null : (
          <div className="flex sm:hidden">{mobileUser}</div>
        )}
      </div>
    </div>
  </header>
);
