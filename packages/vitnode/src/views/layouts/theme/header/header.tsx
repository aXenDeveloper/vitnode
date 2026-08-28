import { getTranslations } from "next-intl/server";
import React from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { LanguageSwitcher } from "@/components/switchers/langs/language-switcher";

import { HEADER_NAV_MESSAGE_KEYS, headerNavItems } from "./header-nav";
import { NextHeaderContent } from "./header-next";
import { UserHeader } from "./user/user";
import { UserHeaderSkeleton } from "./user/user-header-content";

/**
 * The main header on Next.js.
 *
 * The markup moved to {@link HeaderLayoutContent}, which `apps/web` renders too.
 * What is left here is the half only a Next.js request can produce:
 *
 * - **The nav labels**, through `getTranslations`. Resolved on the server, so
 *   `core.search` never has to be shipped to the client provider for the sake of
 *   two words - which is why the nav is passed as data rather than translated
 *   inside the shared header.
 * - **The user slot**, an async Server Component streaming inside its own
 *   `<Suspense>`, exactly as before. The fallback is the shared header's own
 *   skeleton, so the space it reserves is the size of what replaces it.
 * - **The language switcher**, or nothing at all when the deployment serves one
 *   language.
 */
export const HeaderLayout = async ({
  logo,
  vitNodeConfig,
  ...props
}: Omit<React.ComponentProps<"header">, "children"> & {
  logo: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  const t = await getTranslations("core.search");

  return (
    <NextHeaderContent
      {...props}
      languageSwitcher={
        vitNodeConfig.i18n.locales.length > 1 ? (
          <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
        ) : null
      }
      logo={logo}
      navigation={headerNavItems({
        discover: t(HEADER_NAV_MESSAGE_KEYS.discover),
        search: t(HEADER_NAV_MESSAGE_KEYS.search),
      })}
      user={
        <React.Suspense fallback={<UserHeaderSkeleton />}>
          <UserHeader />
        </React.Suspense>
      }
    />
  );
};
