import type { QueryClient } from "@tanstack/react-query";
import type { AbstractIntlMessages } from "use-intl";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator, useTranslations } from "use-intl";

import type { HeaderVariant } from "@/views/layouts/theme/header/header-content";
import type { HeaderNavTranslate } from "@/views/layouts/theme/header/header-nav";

import { useLogo } from "@/components/logo-context";
import {
  navigationMessageNamespace,
  navigationMessageNamespaces,
} from "@/lib/navigation";
import { HeaderLayoutContent } from "@/views/layouts/theme/header/header-content";
import { headerNavItemsFrom } from "@/views/layouts/theme/header/header-nav";
import { MobileNavBar } from "@/views/layouts/theme/header/mobile-nav/mobile-nav-bar";
import { navigationOutsideBottomBar } from "@/views/layouts/theme/header/mobile-nav/mobile-nav-model";
import { getVitNodeConfig } from "@/vitnode.config";

import {
  DEFERRED_MIDDLEWARE_CONFIG,
  middlewareConfigQueryOptions,
} from "../auth/middleware-config";
import { prefetchSession } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "../i18n/query";
import { NotificationsBell } from "../notifications/bell";
import { isSharedRenderRequest } from "../prerender";
import { HeaderSearch } from "../search/header-search";
import { MobileUserMenu } from "./mobile-user-menu";

const NO_MESSAGES: AbstractIntlMessages = {};

const navigationIntlQueryOptions = (locale: string) => {
  const namespaces = navigationMessageNamespaces(getVitNodeConfig().navigation);

  return intlQueryOptions({
    locale,
    namespaces: namespaces.length > 0 ? namespaces : [GLOBAL_NAMESPACE],
  });
};

const headerNavTranslator = (
  locale: string,
  messages: AbstractIntlMessages,
): HeaderNavTranslate => {
  const translators = new Map<string, ReturnType<typeof createTranslator>>();

  return key => {
    const namespace = navigationMessageNamespace(key);
    if (namespace === null) return undefined;

    const translator =
      translators.get(namespace) ??
      createTranslator({ locale, messages, namespace });
    translators.set(namespace, translator);
    const name = key.slice(namespace.length + 1);

    return translator.has(name) ? translator(name) : undefined;
  };
};

/**
 * The site header: logo, the configured `navigation.header` links (labels
 * translated from their message keys), search, notifications and the mobile
 * bottom bar. Most apps render {@link MainHeader}, which adds the user menu.
 */
export const Header = ({
  firstSearchSourceId,
  leading,
  user,
  variant,
}: {
  /** The search source whose results the dialog lists first. */
  firstSearchSourceId?: string;
  /** Rendered before the logo, e.g. a sidebar toggle. */
  leading?: React.ReactNode;
  /** The signed-in user's menu slot. */
  user?: React.ReactNode;
  variant?: HeaderVariant;
}) => {
  const logo = useLogo();
  const locale = useLocale();
  const t = useTranslations("core.global");
  const config = getVitNodeConfig().navigation;
  const { data } = useQuery({
    ...navigationIntlQueryOptions(locale),
    placeholderData: keepPreviousData,
  });
  const messages = data?.messages ?? NO_MESSAGES;
  const translate = React.useMemo(
    () => headerNavTranslator(locale, messages),
    [locale, messages],
  );
  const navigation = React.useMemo(
    () => headerNavItemsFrom({ items: config?.header, translate }),
    [config?.header, translate],
  );
  const bottomBar = React.useMemo(
    () => headerNavItemsFrom({ items: config?.mobileBottomBar, translate }),
    [config?.mobileBottomBar, translate],
  );
  const menuNavigation = React.useMemo(
    () => navigationOutsideBottomBar(navigation, bottomBar),
    [bottomBar, navigation],
  );

  return (
    <>
      <HeaderLayoutContent
        leading={leading}
        logo={logo}
        mobileUser={
          <MobileUserMenu
            hasNavigation={bottomBar.length === 0}
            navigation={navigation}
          />
        }
        moreNavigationLabel={t("more_navigation")}
        navigation={navigation}
        notifications={<NotificationsBell />}
        search={<HeaderSearch firstSourceId={firstSearchSourceId} />}
        user={user}
        variant={variant}
      />
      <MobileNavBar items={bottomBar} menuNavigation={menuNavigation} />
    </>
  );
};

const loadNavigationMessages = async ({
  locale,
  queryClient,
}: {
  locale: string;
  queryClient: QueryClient;
}): Promise<void> => {
  await queryClient.query({
    ...navigationIntlQueryOptions(locale),
    staleTime: "static",
  });
};

/**
 * The main layout route's loader: warms the header's navigation messages, the
 * deployment configuration and the session so the shell renders without
 * waterfalls. During a shared (prerendered or page-cached) render it skips the
 * per-visitor data and loads only the messages.
 *
 * @example
 * ```ts
 * // src/routes/_main.tsx
 * export const Route = createFileRoute("/_main")({
 *   loader: async ({ context }) => await loadMainShell(context),
 *   component: MainLayout,
 * });
 * ```
 */
export const loadMainShell = async (
  context: { locale: string; queryClient: QueryClient },
  {
    isPrerendering = isSharedRenderRequest,
  }: { isPrerendering?: () => boolean } = {},
): Promise<void> => {
  if (isPrerendering()) {
    context.queryClient.setQueryData(
      middlewareConfigQueryOptions().queryKey,
      DEFERRED_MIDDLEWARE_CONFIG,
    );
    await loadNavigationMessages(context);

    return;
  }

  await Promise.all([
    loadNavigationMessages(context),
    context.queryClient.query({
      ...middlewareConfigQueryOptions(),
      staleTime: "static",
    }),
    prefetchSession(context.queryClient),
  ]);
};
