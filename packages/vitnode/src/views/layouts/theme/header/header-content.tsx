"use client";

import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HeaderLinkComponent, HeaderNavItem } from "./header-nav";

import { HEADER_HREF } from "./header-nav";

/**
 * The main header - the bar itself, the logo, the nav and the action area.
 *
 * Presentation only, and framework-free on purpose: it reaches nothing from
 * `next/*`, nothing from `next-intl`'s Next-only entries, nothing from
 * `@/lib/navigation` and nothing from TanStack Router. So a TanStack Start route
 * renders exactly the header the Next.js pages render, down to the class names,
 * instead of a second copy of this markup drifting alongside it.
 *
 * Not to be confused with `components/ui/header-content.tsx`, which is a *page*
 * heading (`<h1>`, description, back button). This is the site header.
 *
 * ## What it takes, and why each one is a prop
 *
 * - `LinkComponent` - the only genuinely framework-specific piece. See
 *   {@link HeaderLinkComponent}.
 * - `logo` - an element, because the mark is the application's, not core's.
 * - `navigation` - data rather than translated in here, because the two
 *   frameworks resolve strings in different places: Next.js on the server, where
 *   they cost the client bundle nothing, and TanStack Start in the browser.
 *   Built by `headerNavItems` on both sides, so the links and their order are
 *   shared even though the lookup is not.
 * - `languageSwitcher` - an element, because *switching* language is navigation
 *   and therefore framework-specific. The dropdown itself is shared
 *   (`components/switchers/langs/language-switcher-content.tsx`); only the two
 *   lines that move the URL differ. Omitted entirely when a deployment serves
 *   one language, which is the caller's question to answer.
 * - `user` - an element. In Next.js it is an async Server Component inside its
 *   own `<Suspense>`; in TanStack Start it is whatever the session slot renders.
 *   Either way the header only needs somewhere to put it.
 *
 * `ThemeSwitcher` is *not* a prop: it reads the theme from `VitNodeProviders`,
 * which both apps mount, and translates through `use-intl`'s context, which both
 * apps provide. It was already framework-neutral - `apps/web` renders it
 * unchanged - so injecting it would be a prop every caller has to pass and
 * nobody gets to answer differently.
 */
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
