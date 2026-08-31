"use client";

import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";

/**
 * The overview panel, which is currently a heading.
 *
 * Rendered by two URLs in each framework: `/settings`, whose root screen shows
 * the overview rather than redirecting to it, and `/settings/overview`. See
 * `SETTINGS_NAV_ITEMS` for why the root is an alias and not a redirect.
 *
 * A client component reading `use-intl` rather than a Server Component reading
 * `next-intl/server`, which is what lets a TanStack Start route render it: the
 * strings come from whichever provider is above it - `I18nProvider` in Next.js,
 * `RouteMessages` in TanStack Start - and both mount `core.auth.settings`.
 *
 * There is deliberately nothing else here. Profile editing, email changes and
 * the rest are not features VitNode has yet, and the route name is not a
 * specification.
 */
export const OverviewSettings = () => {
  const t = useTranslations("core.auth.settings.nav");

  return <HeaderContent h2={t("overview")} />;
};
