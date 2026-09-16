import type { ReactElement, ReactNode } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createElement, useMemo } from "react";
import { IntlProvider, useMessages } from "use-intl";

import { IntlProvider as CoreIntlProvider } from "@/lib/i18n/provider";
import { useLocale } from "@/tanstack/i18n/locale";
import { intlQueryOptions } from "@/tanstack/i18n/query";
import { getIntlRuntime } from "@/tanstack/i18n/runtime";

import { mergeEditorMessages } from "./merge-messages";
import { EDITOR_NAMESPACES } from "./namespaces";

export const EditorMessages = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const locale = useLocale();
  const pageMessages = useMessages();
  const { data } = useSuspenseQuery(
    intlQueryOptions({ locale, namespaces: EDITOR_NAMESPACES }),
  );

  const { hostIntlProvider, timeZone } = getIntlRuntime();

  const messages = useMemo(
    () => mergeEditorMessages(pageMessages, data.messages),
    [data.messages, pageMessages],
  );

  const intlProps = { locale, messages, timeZone };

  const provided = (
    <IntlProvider {...intlProps}>
      <CoreIntlProvider {...intlProps}>{children}</CoreIntlProvider>
    </IntlProvider>
  );

  if (!hostIntlProvider) return provided;

  // eslint-disable-next-line @eslint-react/jsx-no-children-prop
  return createElement(hostIntlProvider, { ...intlProps, children: provided });
};
