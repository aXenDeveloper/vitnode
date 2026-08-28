"use client";

import { usePathname } from "@/lib/navigation";

import { NextAuthLink } from "../next-link";
import { NavSettings } from "./nav";
import { isSettingsRootPath } from "./settings-nav";
import { SettingsShellContent } from "./shell-content";

/**
 * {@link SettingsShellContent}, wired to Next.js.
 *
 * Where Next.js enters the settings frame, and the only place it does: the
 * pathname comes from `next-intl`, the back link is the shared auth `Link`, and
 * the navigation is the Next.js wrapper. Everything visible is
 * `shell-content.tsx`.
 */
export const SettingsShell = ({ children }: { children: React.ReactNode }) => (
  <SettingsShellContent
    BackLink={NextAuthLink}
    isRoot={isSettingsRootPath(usePathname())}
    nav={<NavSettings />}
  >
    {children}
  </SettingsShellContent>
);
