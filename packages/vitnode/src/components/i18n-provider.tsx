import type { Messages, NamespaceKeys, NestedKeyOf } from "next-intl";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "server-only";

import { pickMessages } from "@/lib/i18n/pick-messages";

export { pickMessages };

export async function I18nProvider<
  NestedKey extends NamespaceKeys<Messages, NestedKeyOf<Messages>> = never,
>({
  children,
  namespaces,
  runtimeNamespaces = [],
}: {
  children: React.ReactNode;
  namespaces: NestedKey | NestedKey[];
  runtimeNamespaces?: readonly string[];
}) {
  const locale = await getLocale();
  const messagesInit: object = await getMessages({ locale });
  const messages = pickMessages(messagesInit, [
    "core.global",
    ...(Array.isArray(namespaces) ? namespaces : [namespaces]),
    ...runtimeNamespaces,
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
