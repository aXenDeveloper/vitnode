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

/**
 * What the header renders strings from - and *only* what the header renders.
 *
 * Two words: the `Discover` and `Search` labels in the nav. `core.global` is
 * deliberately not here, and that is the whole point of the list.
 *
 * A namespace set is part of the query key, so asking for `["core.global",
 * "core.search"]` is a *different cache entry* from the `["core.global"]` the
 * root route already ensured - not a superset of it. Listing the global set
 * here therefore bought nothing and cost twice: a second request for messages
 * the root had already fetched, and a second copy of every global string
 * dehydrated into the HTML of every page on the site.
 *
 * Nothing regresses by leaving it out, because nothing in this component reads
 * it. The theme switcher and the language switcher translate through the
 * provider the host's root mounts over `core.global`, which is above every
 * route; the two nav labels are read from *this* query with `createTranslator`
 * and never through a provider. See {@link Header}.
 */
export const HEADER_NAMESPACES = ["core.search"] as const;

/**
 * The messages the header renders, as a query the shell's loader can ensure.
 *
 * Exported so the loader and the component cannot ask for different sets: the
 * namespace list is part of the query key, so a shell that warmed
 * `["core.global"]` would leave the header suspending on a key nobody fetched.
 */
export const headerIntlQueryOptions = ({ locale }: { locale: string }) =>
  intlQueryOptions({ locale, namespaces: HEADER_NAMESPACES });

/**
 * The branch of the message tree the nav reads, named for `createTranslator`.
 *
 * The translator's key type is derived from the *inferred* type of `messages`,
 * and the query resolves to `use-intl`'s bare index signature - which cannot
 * tell a leaf from a branch, so every key it could translate widens to something
 * that checks nothing. Naming the two keys this component actually looks up is
 * both the smallest fix and a true statement: reword one in
 * `core/locales/en.json` and this stops compiling rather than rendering a raw
 * message key into the bar.
 */
interface HeaderNavMessages {
  core: { search: { nav: { discover: string; search: string } } };
}

/**
 * The main header, on TanStack Start.
 *
 * The bar, the logo, the nav and the action area are `HeaderLayoutContent` - the
 * same module the Next.js pages render, so there is one copy of that markup
 * rather than one per framework. What this adds is the orchestration every
 * VitNode TanStack application needs and none of them should write again: the
 * locale, the header's own message set, the translated nav and the language
 * switcher.
 *
 * ## What the shell owes it
 *
 * One warm cache entry: **the shell's loader must ensure
 * {@link headerIntlQueryOptions}**. It is a `useSuspenseQuery` with no boundary
 * between it and the document, so an unwarmed entry does not degrade - it
 * suspends the whole response. Warming it is one line, and it is the same rule
 * every route already follows for its own namespaces.
 *
 * No message provider is mounted here. `core.global` - which the theme switcher
 * and the language switcher read - is provided by the host's root, and the two
 * extra words the nav needs are not worth replacing the message tree over. They
 * are read straight off this query with `createTranslator` instead, which is
 * why this set holds `core.search` alone - see {@link HEADER_NAMESPACES}.
 *
 * ## The two slots a host actually fills
 *
 * `logo`, because the mark belongs to the application rather than to VitNode,
 * and `LinkComponent`, for a host that needs a link built some other way. Both
 * have defaults that are right for an ordinary install, so a plain `<Header />`
 * works and most hosts pass only the mark.
 */
export const Header = ({
  LinkComponent = RouterLink,
  logo = <LogoVitNodeBrand />,
  user,
}: {
  /**
   * How a header path becomes a navigation. Defaults to the router's own `Link`.
   *
   * Overridden only by a host that builds links differently - one mounting
   * VitNode under a path prefix, say. An ordinary install wants the default.
   */
  LinkComponent?: HeaderLinkComponent;
  /**
   * The application's mark. Defaults to VitNode's own, responsively.
   *
   * The default is deliberately `LogoVitNodeBrand` rather than the
   * `<LogoVitNode className="w-34" />` the Next.js layouts pass: a Next.js app
   * writes that class in its own `layout.tsx`, where Tailwind scans it, and a
   * TanStack host writes nothing - the class would exist only inside this
   * package's compiled `dist`, which an app's `@source` list has to be told
   * about. See `apps/web/src/styles.css`, which now is. The brand component also
   * answers the question that class never did, which is what a 136px wordmark
   * should do on a 320px-wide bar.
   */
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

/**
 * What the site header needs, warmed before anything renders.
 *
 * Both entries are an app's canonical ones - the same query definitions its
 * routes and its auth guards already use - so this adds no second key and no
 * second request. What it adds is *timing*: the header sits above every page in
 * the shell, so anything it reads has to be in hand before the first paint or
 * the shell pays a round trip that the page below it did not.
 *
 * ## One `ensure`, one `prefetch`, and the difference matters
 *
 * `ensureQueryData` for the messages, because `Header` reads them with
 * `useSuspenseQuery` and there is no Suspense boundary between it and the
 * document. An unwarmed entry there does not degrade - it suspends the whole
 * response. The namespace list is part of the query key, which is why the
 * options come from `headerIntlQueryOptions` rather than being spelled out: a
 * loader that warmed a different set would warm a key nobody reads.
 *
 * `prefetchQuery` for the session, through `prefetchSession`, because a failure
 * must not take the page down with it. `ensureAuthState` is the wrong tool here
 * in one specific way: it *rejects* when the session cannot be read, which is
 * exactly right for a guard - an outage must not sign anybody out - and exactly
 * wrong for a shell, where the same rejection would replace every page on the
 * site with an error screen because the header could not name the visitor.
 * Prefetching records the failure in the cache entry instead, and
 * `userHeaderState` renders it as the guest controls.
 *
 * `Promise.all`, because neither read depends on the other.
 */
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
