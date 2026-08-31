"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { IntlProvider } from "use-intl";

import { IntlProvider as CoreIntlProvider } from "@/lib/i18n/provider";

import { useLocale } from "./locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "./query";
import { getIntlRuntime } from "./runtime";

/**
 * The strings one route renders, scoped to that route.
 *
 * The root provides `core.global` and nothing else, deliberately: the merged
 * message tree holds every plugin's AdminCP copy, and a page should ship only
 * the branches it actually renders. This is the other half of that rule - the
 * TanStack Start counterpart of `<I18nProvider namespaces={[...]}>`, which is
 * how the Next.js pages have always done it.
 *
 * With no `namespaces` it provides exactly `core.global`, which is what a root
 * route wants: mounted once above every page, it is the shell's provider. A
 * route mounts a second one underneath with its own namespaces, and the inner
 * pair wins for the strings it names.
 *
 * ## It reads, it does not fetch
 *
 * `useSuspenseQuery` over the same `intlQueryOptions` the route's loader
 * already warmed, so on the first render the entry is there and nothing
 * suspends. A route that mounts this **must** ensure the identical options in
 * its loader - same locale, same namespaces - or the first paint is a suspend
 * and the strings arrive a round trip late.
 *
 * ## Why three providers
 *
 * One component, up to three module records. Under a host's `vite dev`,
 * `@vitnode/core` is external to that app's SSR pass and therefore loaded by
 * Node, which resolves `use-intl` to its `default` (production) build, while the
 * app's own source runs through Vite's module runner, which resolves the same
 * dependency with the `development` condition. Same version, same `node_modules`
 * entry, two files - and `createContext` runs once per file, so they are two
 * React contexts.
 *
 * Both of the providers *this file* imports are on the package's side of that
 * split, because this file is: `use-intl` and `@/lib/i18n/provider` are resolved
 * by whatever loaded the package. The pair is still worth mounting - the second
 * is by construction the record every shared component reads, including the
 * design-system components that used to reach it through `next-intl` - but
 * neither of them is the record the *host's* own components read. Nothing here
 * can import that one, so the host registers it:
 *
 *     configureIntl({ ..., hostIntlProvider: IntlProvider })  // from its use-intl
 *
 * and it goes on the outside. Without it a host route that calls
 * `useTranslations` itself throws "No intl context found" on the server, React
 * falls back to client rendering, and the page renders anyway - a 500 in the
 * console and a silent loss of SSR for that route. `HostIntlProvider` in
 * `./runtime` carries the rest of the argument.
 *
 * A production build resolves the dependency once and collapses all three into
 * one component around identical props, which is exactly what makes this a
 * `vite dev`-only failure the built server never shows.
 * `provider-records.test.ts` guards the arrangement on the source, because
 * nothing that runs under Vitest can reproduce two records.
 *
 * All three get the same props from one object: two providers that disagreed
 * would render half a page in the wrong language. This is also why they belong
 * *here*, at the route boundary, rather than around each component that
 * translates - a leaf that mounted its own would be the one place the route's
 * namespaces could go missing.
 */
export const RouteMessages = ({
  children,
  namespaces = [GLOBAL_NAMESPACE],
}: {
  children: React.ReactNode;
  namespaces?: readonly string[];
}) => {
  const locale = useLocale();
  const { data } = useSuspenseQuery(intlQueryOptions({ locale, namespaces }));

  const { hostIntlProvider, timeZone } = getIntlRuntime();

  const intlProps = { locale, messages: data.messages, timeZone };

  const provided = (
    <IntlProvider {...intlProps}>
      <CoreIntlProvider {...intlProps}>{children}</CoreIntlProvider>
    </IntlProvider>
  );

  if (!hostIntlProvider) return provided;

  // `createElement` rather than JSX: the component comes out of the registry, so
  // naming it in render would read as one declared there - which is the thing
  // that remounts a subtree every render, and what `static-components` bans. It
  // is a single module-scope reference registered once per process, so the
  // element type is stable and nothing below it ever remounts.
  //
  // `children` goes in the props rather than in `createElement`'s third
  // argument because `HostIntlProvider` requires it - `use-intl`'s own
  // `IntlProvider` does, and widening the registry's type to make it optional
  // would stop that provider satisfying it. It is the same element either way.
  // eslint-disable-next-line @eslint-react/jsx-no-children-prop
  return createElement(hostIntlProvider, { ...intlProps, children: provided });
};
