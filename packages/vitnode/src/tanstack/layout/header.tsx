import type { QueryClient } from "@tanstack/react-query";
import type { AbstractIntlMessages } from "use-intl";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { HeaderNavTranslate } from "@/views/layouts/theme/header/header-nav";

import { LogoVitNodeBrand } from "@/components/logo-vitnode";
import { HeaderLayoutContent } from "@/views/layouts/theme/header/header-content";
import {
  headerNavItemsFrom,
  headerNavNamespaces,
} from "@/views/layouts/theme/header/header-nav";

import {
  middlewareConfigQueryOptions,
  useMiddlewareConfigQuery,
} from "../auth/middleware-config";
import { prefetchSession } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "../i18n/query";

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
  const { data: config } = useMiddlewareConfigQuery();
  const namespaces = headerNavNamespaces(config.navigation, GLOBAL_NAMESPACE);
  const { data } = useSuspenseQuery(intlQueryOptions({ locale, namespaces }));

  const navigation = React.useMemo(
    () =>
      headerNavItemsFrom({
        items: config.navigation,
        locale,
        translate: headerNavTranslator(locale, data.messages),
      }),
    [config.navigation, data.messages, locale],
  );

  return (
    <HeaderLayoutContent logo={logo} navigation={navigation} user={user} />
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
      namespaces: headerNavNamespaces(config.navigation, GLOBAL_NAMESPACE),
    }),
    staleTime: "static",
  });
};
