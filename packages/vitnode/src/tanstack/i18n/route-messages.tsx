import { useSuspenseQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { IntlProvider } from "use-intl";

import { IntlProvider as CoreIntlProvider } from "@/lib/i18n/provider";

import { useLocale } from "./locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "./query";
import { getIntlRuntime } from "./runtime";

/**
 * Provides translations for a subtree: loads the given message namespaces for
 * the current locale (suspending until they arrive) and mounts `use-intl`'s
 * provider with them, so `useTranslations` works below it.
 *
 * Plugin pages get their declared `messages` automatically; reach for this in
 * the app's own routes, layouts and components that render outside one - a
 * breadcrumb crumb with its own strings, for example. Warm the same namespaces
 * in the route's loader with `intlQueryOptions` to avoid a waterfall.
 *
 * @example
 * ```tsx
 * import { RouteMessages } from "@vitnode/core/tanstack/i18n";
 *
 * <RouteMessages namespaces={["core.global", "@vitnode/blog.post"]}>
 *   <PostTitle />
 * </RouteMessages>;
 * ```
 */
export const RouteMessages = ({
  children,
  namespaces = [GLOBAL_NAMESPACE],
}: {
  children: React.ReactNode;
  /** Message namespaces to load, e.g. `@vitnode/blog.post`. Defaults to `core.global`. */
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
  // oxlint-disable-next-line @eslint-react/jsx-no-children-prop
  return createElement(hostIntlProvider, { ...intlProps, children: provided });
};
