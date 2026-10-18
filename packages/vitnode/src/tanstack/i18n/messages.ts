import type { AbstractIntlMessages } from "use-intl";

import "@tanstack/react-start/server-only";

import type {
  AppMessagesMap,
  LocaleMessagesMap,
  MessagesSource,
} from "@/lib/i18n/types";
import type { VitNodeServerConfig } from "@/vitnode.config";

import { loadMessages } from "@/lib/i18n/load-messages";
import { pickMessages } from "@/lib/i18n/pick-messages";
import { buildAppMessagesSources } from "@/lib/i18n/sources";
import { manifest } from "@/manifest";

import type { IntlMessages } from "./runtime";

const WEB_SCOPE = "web";

export interface BundledMessagesOptions {
  /** The app's own overrides, keyed by locale and then plugin id. */
  appMessages?: AppMessagesMap;

  packageMessages: Record<string, LocaleMessagesMap | undefined>;
  /** The plugins this app registered, in the order they merge. */
  plugins: { pluginId: string }[];
}

export const buildBundledMessagesSources = ({
  appMessages,
  packageMessages,
  plugins,
}: BundledMessagesOptions): MessagesSource[] =>
  [
    {
      id: manifest.id,
      messages: packageMessages[manifest.id],
    },
    ...plugins.map(({ pluginId }) => ({
      id: pluginId,
      messages: packageMessages[pluginId],
    })),
    ...buildAppMessagesSources(appMessages, WEB_SCOPE),
  ].map(source => ({ ...source, scope: WEB_SCOPE }));

export interface IntlMessagesLoaderOptions extends BundledMessagesOptions {
  defaultLocale: string;
}

/** The messages one page needs, in one language. */
export type IntlMessagesLoader = (args: {
  locale: string;
  namespaces: readonly string[];
}) => Promise<IntlMessages>;

const isServerConfig = (
  options: IntlMessagesLoaderOptions | VitNodeServerConfig,
): options is VitNodeServerConfig => "config" in options;

const loaderOptionsFrom = (
  options: IntlMessagesLoaderOptions | VitNodeServerConfig,
): IntlMessagesLoaderOptions =>
  isServerConfig(options)
    ? {
        appMessages: options.messages,
        defaultLocale: options.config.i18n.defaultLocale,
        packageMessages: options.packageMessages ?? {},
        plugins: options.config.plugins,
      }
    : options;

/**
 * Builds the server-side loader `configureIntl`'s `fetchMessages` calls: it
 * merges core's, each plugin's and the app's messages for a locale over the
 * default locale (so a missing key falls back key by key) and returns only the
 * requested namespaces. Merged trees are cached per process in production.
 *
 * Server-only - import it from `@vitnode/core/tanstack/i18n/server`. Pass the
 * app's server config, or the sources explicitly.
 *
 * @example
 * ```ts
 * // src/server/messages.server.ts
 * import "@tanstack/react-start/server-only";
 * import { createIntlMessagesLoader } from "@vitnode/core/tanstack/i18n/server";
 *
 * import { vitNodeServerConfig } from "@/vitnode.server.config";
 *
 * export const loadIntlMessages = createIntlMessagesLoader(vitNodeServerConfig);
 * ```
 */
export function createIntlMessagesLoader(
  options: IntlMessagesLoaderOptions | VitNodeServerConfig,
): IntlMessagesLoader {
  const { defaultLocale, ...sourceOptions } = loaderOptionsFrom(options);
  const sources = buildBundledMessagesSources(sourceOptions);

  return async ({
    locale,
    namespaces,
  }: {
    locale: string;
    namespaces: readonly string[];
  }): Promise<IntlMessages> => {
    const merged = await loadMessages({ defaultLocale, locale, sources });

    // `pickMessages` walks an unknown tree and cannot know what it found; what
    // it returns is a message tree by construction, every leaf a string from a
    // JSON file. Asserted here, once, rather than by every caller.
    return {
      locale,
      messages: pickMessages(merged, namespaces) as AbstractIntlMessages,
    };
  };
}
