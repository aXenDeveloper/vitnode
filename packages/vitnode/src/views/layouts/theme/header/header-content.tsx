import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import {
  HEADER_VIEW_TRANSITION_NAMES,
  LOGO_VIEW_TRANSITION_NAME,
} from "@/tanstack/view-transitions";

import type { HeaderNavItem } from "./header-nav";

import { HEADER_HREF } from "./header-nav";
import { HeaderNavMenu } from "./header-nav-menu";

export interface HeaderLayoutContentProps extends Omit<
  React.ComponentProps<"header">,
  "children"
> {
  leading?: React.ReactNode;
  logo: React.ReactNode;
  mobileUser?: React.ReactNode;
  moreNavigationLabel: string;
  navigation: HeaderNavItem[];
  notifications?: React.ReactNode;
  search?: React.ReactNode;
  user?: React.ReactNode;
  variant?: HeaderVariant;
}

export type HeaderVariant = "bar" | "floating";

const HEADER_VARIANT_CLASS_NAMES: Record<
  HeaderVariant,
  { bar: string; header: string }
> = {
  bar: {
    bar: "bg-background dark:bg-card flex h-14 items-center border-b px-4 py-2 md:px-3",
    header: "sticky top-0 z-20 w-full",
  },
  floating: {
    bar: "dark:bg-background/75 bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm",
    header: "sticky top-0 z-20 w-full sm:top-2 sm:mt-2 sm:px-4",
  },
};

export const HeaderLayoutContent = ({
  className,
  leading,
  logo,
  mobileUser,
  moreNavigationLabel,
  navigation,
  notifications,
  search,
  user,
  variant = "floating",
  ...props
}: HeaderLayoutContentProps) => (
  <header
    className={cn(HEADER_VARIANT_CLASS_NAMES[variant].header, className)}
    {...props}
  >
    <div
      className={HEADER_VARIANT_CLASS_NAMES[variant].bar}
      style={{ viewTransitionName: HEADER_VIEW_TRANSITION_NAMES.bar }}
    >
      {leading}
      <Link
        className="flex shrink-0 items-center"
        style={{ viewTransitionName: LOGO_VIEW_TRANSITION_NAME }}
        to={HEADER_HREF.home}
      >
        {logo}
      </Link>

      <div
        className="ms-4 hidden min-w-0 flex-1 sm:flex"
        style={{ viewTransitionName: HEADER_VIEW_TRANSITION_NAMES.navigation }}
      >
        <HeaderNavMenu
          moreLabel={moreNavigationLabel}
          navigation={navigation}
        />
      </div>

      <div
        className="ms-auto flex shrink-0 items-center gap-2"
        style={{ viewTransitionName: HEADER_VIEW_TRANSITION_NAMES.actions }}
      >
        {search}
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
