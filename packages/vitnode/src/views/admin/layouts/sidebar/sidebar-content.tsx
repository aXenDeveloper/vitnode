import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { LogoVitNode } from "@/components/logo-vitnode";
import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

/**
 * The AdminCP sidebar's frame: the mark, the switchers, and whatever navigation
 * is passed in.
 *
 * Two seams, and they exist for different reasons:
 *
 * - **`LinkComponent`** - the mark links to `/admin/core`, and turning a path
 *   into a navigation is the one question whose answer differs between
 *   frameworks. The same seam every shared VitNode view draws.
 * - **`languageSwitcher`** - a *slot* rather than a component, because the
 *   switcher is not one component with a prop difference. Next.js switches a
 *   locale by pushing a rewritten pathname through `next-intl`'s router;
 *   TanStack Start does it through `useSwitchLocale` and the router's own
 *   rewrite. They share the trigger's markup and nothing else, so each host
 *   passes its own and this component stays out of it.
 *
 * `ThemeSwitcher` is imported directly and deliberately: it reads VitNode's own
 * `ThemeProvider` and touches no router at all, so there is nothing for a host
 * to decide.
 *
 * Whether a switcher appears at all is the caller's decision too - a single-
 * language install passes nothing, and this renders no empty slot.
 */
export const SidebarAdminContent = ({
  children,
  languageSwitcher,
  LinkComponent,
}: {
  children: React.ReactNode;
  /** The host's own language switcher, or nothing on a single-language install. */
  languageSwitcher?: React.ReactNode;
  LinkComponent: AuthLinkComponent;
}) => (
  <Sidebar variant="floating">
    <SidebarHeader className="flex h-16 flex-row items-center gap-2 border-b">
      <LinkComponent className="mr-auto px-2" href="/admin/core">
        <LogoVitNode className="size-8" small />
      </LinkComponent>

      {languageSwitcher}
      <ThemeSwitcher />
    </SidebarHeader>

    <SidebarContent>{children}</SidebarContent>
  </Sidebar>
);
