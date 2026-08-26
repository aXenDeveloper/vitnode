import type { Messages, NamespaceKeys, NestedKeyOf } from "next-intl";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "server-only";

/**
 * The subset of a message tree a client bundle is allowed to see.
 *
 * Exported so the namespace rule is testable on its own: which namespaces reach
 * the client is the difference between a plugin's admin screen rendering and
 * every string on it throwing `MISSING_MESSAGE`, and that is a rule worth
 * pinning rather than a detail of a server component.
 *
 * A path that resolves to nothing is skipped, not defaulted - an unregistered
 * plugin id simply contributes no messages.
 */
export const pickMessages = (obj: object, paths: readonly string[]) => {
  const result = {};
  for (const path of paths) {
    const keys = path.split(".");
    let src: object | undefined = obj;
    let dest = result;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (src && Object.hasOwn(src, key)) {
        if (i === keys.length - 1) {
          dest[key] = src[key];
        } else {
          dest[key] ??= {};
          dest = dest[key];
          src = src[key];
        }
      } else {
        break;
      }
    }
  }

  return result;
};

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
