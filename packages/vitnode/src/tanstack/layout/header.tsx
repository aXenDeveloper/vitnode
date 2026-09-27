import type { QueryClient } from "@tanstack/react-query";
import type { AbstractIntlMessages } from "use-intl";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator, useTranslations } from "use-intl";

import type {
  PublicNavigationItem,
  PublicNavigationNode,
} from "@/lib/navigation";
import type { HeaderNavTranslate } from "@/views/layouts/theme/header/header-nav";

import { LogoVitNodeBrand } from "@/components/logo-vitnode";
import { HeaderLayoutContent } from "@/views/layouts/theme/header/header-content";
import {
  headerNavItemsFrom,
  headerNavNamespaces,
} from "@/views/layouts/theme/header/header-nav";
import { MobileNavBar } from "@/views/layouts/theme/header/mobile-nav/mobile-nav-bar";
import { navigationOutsideBottomBar } from "@/views/layouts/theme/header/mobile-nav/mobile-nav-model";

import {
  middlewareConfigQueryOptions,
  useMiddlewareConfigQuery,
} from "../auth/middleware-config";
import { prefetchSession } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "../i18n/query";
import { MobileUserMenu } from "./mobile-user-menu";

const asNavigationNodes = (
  items: readonly PublicNavigationItem[],
): PublicNavigationNode[] => items.map(item => ({ ...item, items: [] }));

const headerNavTranslator = (
  locale: string,
  messages: AbstractIntlMessages,
): HeaderNavTranslate => {
  const translators = new Map<string, ReturnType<typeof createTranslator>>();

  return (namespace, key) => {
    const translator =
      translators.get(namespace) ??
      createTranslator({ locale, messages, namespace });
    translators.set(namespace, translator);

    return translator.has(key) ? translator(key) : undefined;
  };
};

export const Header = ({
  logo = <LogoVitNodeBrand />,
  user,
}: {
  logo?: React.ReactNode;
  user?: React.ReactNode;
}) => {
  const locale = useLocale();
  const t = useTranslations("core.global");
  const { data: config } = useMiddlewareConfigQuery();
  const bottomBarNodes = React.useMemo(
    () => asNavigationNodes(config.bottomBar),
    [config.bottomBar],
  );
  const namespaces = headerNavNamespaces(
    [...config.navigation, ...bottomBarNodes],
    GLOBAL_NAMESPACE,
  );
  const { data } = useSuspenseQuery(intlQueryOptions({ locale, namespaces }));

  const translate = React.useMemo(
    () => headerNavTranslator(locale, data.messages),
    [data.messages, locale],
  );
  const navigation = React.useMemo(
    () => headerNavItemsFrom({ items: config.navigation, locale, translate }),
    [config.navigation, locale, translate],
  );
  const bottomBar = React.useMemo(
    () => headerNavItemsFrom({ items: bottomBarNodes, locale, translate }),
    [bottomBarNodes, locale, translate],
  );
  const menuNavigation = React.useMemo(
    () => navigationOutsideBottomBar(navigation, bottomBar),
    [bottomBar, navigation],
  );

  return (
    <>
      <HeaderLayoutContent
        logo={logo}
        mobileUser={
          <MobileUserMenu
            hasNavigation={bottomBar.length === 0}
            navigation={navigation}
          />
        }
        moreNavigationLabel={t("more_navigation")}
        navigation={navigation}
        user={user}
      />
      <MobileNavBar items={bottomBar} menuNavigation={menuNavigation} />
    </>
  );
};

export const loadMainShell = async ({
  locale,
  queryClient,
}: {
  locale: string;
  queryClient: QueryClient;
}): Promise<void> => {
  const [config] = await Promise.all([
    queryClient.query({
      ...middlewareConfigQueryOptions(),
      staleTime: "static",
    }),
    prefetchSession(queryClient),
  ]);

  await queryClient.query({
    ...intlQueryOptions({
      locale,
      namespaces: headerNavNamespaces(
        [...config.navigation, ...asNavigationNodes(config.bottomBar)],
        GLOBAL_NAMESPACE,
      ),
    }),
    staleTime: "static",
  });
};
