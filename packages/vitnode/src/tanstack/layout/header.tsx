import type { QueryClient } from "@tanstack/react-query";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createTranslator } from "use-intl";

import type { HeaderNavItem } from "@/views/layouts/theme/header/header-nav";

import { LogoVitNodeBrand } from "@/components/logo-vitnode";
import { HeaderLayoutContent } from "@/views/layouts/theme/header/header-content";
import {
  HEADER_NAV_MESSAGE_KEYS,
  headerNavItems,
} from "@/views/layouts/theme/header/header-nav";

import { prefetchSession } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import { intlQueryOptions } from "../i18n/query";

export const HEADER_NAMESPACES = ["core.search"] as const;

export const headerIntlQueryOptions = ({ locale }: { locale: string }) =>
  intlQueryOptions({ locale, namespaces: HEADER_NAMESPACES });

const EXAMPLE_NAV_ITEMS: HeaderNavItem[] = [
  {
    href: "/example-community",
    items: [
      {
        description: "Threads from everyone building on VitNode.",
        href: "/discover",
        label: "Discussions",
      },
      {
        description: "Who is here and what they are shipping.",
        href: "/search",
        label: "Members",
      },
    ],
    label: "Community",
  },
  {
    href: "/example-resources",
    items: [
      {
        description: "Guides, the API reference and every plugin.",
        href: "/docs",
        label: "Documentation",
      },
      {
        description: "Release notes, in order, newest first.",
        href: "/discover",
        label: "Changelog",
      },
      {
        description: "Ask a question and get an answer from the team.",
        href: "/search",
        label: "Support",
      },
    ],
    label: "Resources",
  },
];

interface HeaderNavMessages {
  core: { search: { nav: { discover: string; search: string } } };
}

export const Header = ({
  logo = <LogoVitNodeBrand />,
  user,
}: {
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
      logo={logo}
      navigation={[
        ...headerNavItems({
          discover: t(HEADER_NAV_MESSAGE_KEYS.discover),
          search: t(HEADER_NAV_MESSAGE_KEYS.search),
        }),
        ...EXAMPLE_NAV_ITEMS,
      ]}
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
    queryClient.query({
      ...headerIntlQueryOptions({ locale }),
      staleTime: "static",
    }),
    prefetchSession(queryClient),
  ]);
};
