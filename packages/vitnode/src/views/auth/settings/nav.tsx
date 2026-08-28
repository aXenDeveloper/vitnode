"use client";

import { usePathname } from "@/lib/navigation";

import { NextAuthLink } from "../next-link";
import { SettingsNavContent } from "./nav-content";

/**
 * {@link SettingsNavContent}, wired to Next.js.
 *
 * The two framework-specific halves and nothing else: `next-intl`'s locale-aware
 * `usePathname`, which answers with the internal path the route tree uses, and
 * the same `Link` every other auth screen renders. Which items exist and which
 * one is selected is `settings-nav.ts`, shared.
 */
export const NavSettings = () => (
  <SettingsNavContent LinkComponent={NextAuthLink} pathname={usePathname()} />
);
