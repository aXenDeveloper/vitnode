"use client";

import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";

/**
 * The security panel, which is currently a heading.
 *
 * A client component reading `use-intl` rather than a Server Component reading
 * `next-intl/server`, for the reason `OverviewSettings` explains: it is rendered
 * by a Next.js page and by a TanStack Start route, and only one of those has a
 * request scope.
 *
 * Passwords, two-factor enrolment, passkeys and a session log are not features
 * VitNode has yet. This file is what `/settings/security` does today, and the
 * route name is not a specification.
 */
export const SecuritySettings = () => {
  const t = useTranslations("core.auth.settings.nav");

  return <HeaderContent h2={t("security")} />;
};
