"use client";

import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HeaderLinkComponent, HeaderNavItem } from "./header-nav";

import { HEADER_HREF } from "./header-nav";

export interface HeaderLayoutContentProps extends Omit<
  React.ComponentProps<"header">,
  "children"
> {
  languageSwitcher?: React.ReactNode;
  LinkComponent: HeaderLinkComponent;
  logo: React.ReactNode;
  navigation: HeaderNavItem[];
  user?: React.ReactNode;
}

export const HeaderLayoutContent = ({
  LinkComponent,
  className,
  languageSwitcher,
  logo,
  navigation,
  user,
  ...props
}: HeaderLayoutContentProps) => (
  <header className={cn("sticky top-0 z-20 w-full", className)} {...props}>
    <div className="dark:bg-background/75 bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm">
      <LinkComponent href={HEADER_HREF.home}>{logo}</LinkComponent>

      <nav className="ms-4 hidden items-center gap-1 sm:flex">
        {navigation.map(item => (
          <LinkComponent
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </LinkComponent>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {languageSwitcher}
        <ThemeSwitcher />
        {user}
      </div>
    </div>
  </header>
);
