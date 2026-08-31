import "@tanstack/react-start/server-only";
import type { AbstractIntlMessages } from "use-intl";

import type {
  AppMessagesMap,
  LocaleMessagesMap,
  MessagesSource,
} from "@/lib/i18n/types";

import { CONFIG_PLUGIN } from "@/config";
import { loadMessages } from "@/lib/i18n/load-messages";
import { pickMessages } from "@/lib/i18n/pick-messages";
import { buildAppMessagesSources } from "@/lib/i18n/sources";

import type { IntlMessages } from "./runtime";

/**
 * The frontend scope, which is part of `loadMessages`' cache key.
 *
 * A TanStack Start app serves its API in the same process, and a plugin ships a
 * different tree to each platform under one id - so the web tree has to be
 * marked as one, or whichever of the two loaded first would be served to both.
 */
const WEB_SCOPE = "web";

export interface BundledMessagesOptions {
  /** The app's own overrides, keyed by locale and then plugin id. */
  appMessages?: AppMessagesMap;
  /**
   * Where each installed package's translations are read from, keyed by plugin
   * id - core included.
   *
   * The one part of the source list a package cannot supply. Every VitNode
   * package ships a locale barrel that loads its own files with a runtime
   * `import("./en.json", { with: { type: "json" } })`, which is exactly right
   * under Node and is how `apps/api` reads them. Rollup will not
   * follow a dynamic import carrying an import attribute, so in a bundled
   * runtime it neither emits the JSON nor rewrites the specifier, and every
   * string renders as its own key. A host declares static specifiers a bundler
   * can follow and hands them in here.
   */
  packageMessages: Record<string, LocaleMessagesMap | undefined>;
  /** The plugins this app registered, in the order they merge. */
  plugins: { pluginId: string }[];
}

/**
 * Everything that contributes translations, in the order they merge.
 *
 * Core first, then each registered plugin, then whatever the app overrides -
 * later sources win, so a plugin can reword a core string and the app can reword
 * either. That is exactly `buildMessagesSources`' order; the difference is only
 * where the loaders come from, and {@link BundledMessagesOptions.packageMessages}
 * explains why a bundled runtime has to supply its own.
 */
export const buildBundledMessagesSources = ({
  appMessages,
  packageMessages,
  plugins,
}: BundledMessagesOptions): MessagesSource[] =>
  [
    {
      id: CONFIG_PLUGIN.pluginId,
      messages: packageMessages[CONFIG_PLUGIN.pluginId],
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

/**
 * The messages one page needs, in one language - as a loader bound to an app.
 *
 * A factory rather than a function that reads a registered config, because this
 * half runs on the server only and the server already has the app's config in
 * hand: the host calls this once in the module its server function delegates to.
 *
 * `locale` and `namespaces` are arguments and there is no hidden state, so the
 * same loader serves SSR, a client-side navigation, and a prefetch of a language
 * the visitor is not currently reading in - and the query that calls it can be
 * keyed by exactly what it asked for.
 *
 * `namespaces` is the other half of the rule VitNode has always had: the merged
 * tree holds every plugin's AdminCP copy, and a page that renders none of it
 * should not ship it. Only the branches named cross to the browser. A page asks
 * for what it renders - `["core.global", "core.discover"]` - and gets that and
 * nothing else.
 *
 * Underneath, nothing about the pipeline is new: `loadMessages` merges core, the
 * plugins and the app's overrides for `locale`, with the default locale
 * underneath as a per-key fallback, so a half-translated language degrades one
 * string at a time instead of showing raw keys.
 */
export const createIntlMessagesLoader = ({
  defaultLocale,
  ...sourceOptions
}: IntlMessagesLoaderOptions) => {
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
};
