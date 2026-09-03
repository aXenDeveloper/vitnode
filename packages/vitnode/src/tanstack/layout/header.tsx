"use client";

import type { QueryClient } from "@tanstack/react-query";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createTranslator } from "use-intl";

import type { HeaderLinkComponent } from "@/views/layouts/theme/header/header-nav";

import { LogoVitNodeBrand } from "@/components/logo-vitnode";
import { HeaderLayoutContent } from "@/views/layouts/theme/header/header-content";
import {
  HEADER_NAV_MESSAGE_KEYS,
  headerNavItems,
} from "@/views/layouts/theme/header/header-nav";

import { prefetchSession } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { intlQueryOptions } from "../i18n/query";
import { LanguageSwitcher } from "./language-switcher";
import { RouterLink } from "./router-link";

export const HEADER_NAMESPACES = ["core.search"] as const;

export const headerIntlQueryOptions = ({ locale }: { locale: string }) =>
  intlQueryOptions({ locale, namespaces: HEADER_NAMESPACES });

interface HeaderNavMessages {
  core: { search: { nav: { discover: string; search: string } } };
}

export const Header = ({
  LinkComponent = RouterLink,
  logo = <LogoVitNodeBrand />,
  user,
}: {
  LinkComponent?: HeaderLinkComponent;

  logo?: React.ReactNode;
  /** The session slot - avatar and menu when signed in, sign-in button when not. */
  user?: React.ReactNode;
}) => {
  const locale = useLocale();
  const { data } = useSuspenseQuery(headerIntlQueryOptions({ locale }));

  const t = createTranslator({
    locale,
    messages: data.messages as unknown as HeaderNavMessages,
    namespace: "core.search",
  });

  return (
    <HeaderLayoutContent
      languageSwitcher={<LanguageSwitcher />}
      LinkComponent={LinkComponent}
      logo={logo}
      navigation={headerNavItems({
        discover: t(HEADER_NAV_MESSAGE_KEYS.discover),
        search: t(HEADER_NAV_MESSAGE_KEYS.search),
      })}
      user={user}
    />
  );
};

export const loadMainShell = async ({
  locale,
  queryClient,
}: {
  locale: string;
  queryClient: QueryClient;
}): Promise<void> => {
  await Promise.all([
    queryClient.ensureQueryData(headerIntlQueryOptions({ locale })),
    prefetchSession(queryClient),
  ]);
};
