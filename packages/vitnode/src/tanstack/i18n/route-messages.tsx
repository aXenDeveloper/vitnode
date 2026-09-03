"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { IntlProvider } from "use-intl";

import { IntlProvider as CoreIntlProvider } from "@/lib/i18n/provider";

import { useLocale } from "./locale";
import { GLOBAL_NAMESPACE, intlQueryOptions } from "./query";
import { getIntlRuntime } from "./runtime";

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
