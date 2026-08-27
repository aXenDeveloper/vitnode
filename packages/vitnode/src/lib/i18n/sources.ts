import { CONFIG_PLUGIN } from "@/config";
import coreMessages from "@/locales";
import coreApiMessages from "@/locales/api";

import type {
  AppMessagesMap,
  LocaleMessagesMap,
  MessagesSource,
} from "./types";

/**
 * Splits an app's overrides into one source per plugin namespace, so they merge
 * on top of the package that owns those keys.
 */
const appMessagesToSources = (
  appMessages: AppMessagesMap | undefined,
): MessagesSource[] => {
  if (!appMessages) return [];

  const byPlugin = new Map<string, LocaleMessagesMap>();

  for (const [locale, perPlugin] of Object.entries(appMessages)) {
    for (const [pluginId, loader] of Object.entries(perPlugin)) {
      byPlugin.set(pluginId, { ...byPlugin.get(pluginId), [locale]: loader });
    }
  }

  return [...byPlugin].map(([pluginId, messages]) => ({
    id: `app:${pluginId}`,
    messages,
    optional: true,
  }));
};

/**
 * An app's own overrides, as sources, for an app that assembles the rest of the
 * list itself.
 *
 * `buildMessagesSources` below is the normal way in, and it calls this. It is
 * exported for the one case that cannot use it: a bundled runtime, where each
 * package's locale barrel has to be replaced by loaders the bundler can follow
 * (see `apps/web/src/locales/packages.ts`). Splitting overrides per plugin
 * namespace is fiddly enough that copying it there would be a second
 * implementation to keep in step.
 */
export const buildAppMessagesSources = (
  appMessages: AppMessagesMap | undefined,
  scope: string,
): MessagesSource[] =>
  appMessagesToSources(appMessages).map(source => ({ ...source, scope }));

/**
 * The ordered list of everything that contributes translations: core first,
 * then each installed plugin, then whatever the app overrides. Later sources
 * win, so an app can reword a core string without forking it.
 *
 * `coreBarrel` is the only difference between the two platforms - the frontend
 * gets core's UI strings, the server gets its email strings. Plugins bring
 * whichever tree they registered (`buildPlugin` vs `buildApiPlugin`), and app
 * overrides are keyed by plugin id, so a superset override file works for both.
 */
const buildSources = ({
  appMessages,
  coreBarrel,
  plugins,
  scope,
}: {
  appMessages?: AppMessagesMap;
  coreBarrel: LocaleMessagesMap;
  plugins: { messages?: LocaleMessagesMap; pluginId: string }[];
  scope: string;
}): MessagesSource[] =>
  [
    { id: CONFIG_PLUGIN.pluginId, messages: coreBarrel },
    ...plugins.map(plugin => ({
      id: plugin.pluginId,
      messages: plugin.messages,
    })),
    ...appMessagesToSources(appMessages),
    // A plugin ships a different tree to each platform under one id, so every
    // source is stamped with its scope - the cache keys off it (see
    // `loadMessages`) and a single app can hold both trees at once.
  ].map(source => ({ ...source, scope }));

/** Sources for the frontend: core's UI strings plus each plugin's UI tree. */
export const buildMessagesSources = (args: {
  appMessages?: AppMessagesMap;
  plugins: { messages?: LocaleMessagesMap; pluginId: string }[];
}): MessagesSource[] =>
  buildSources({ ...args, coreBarrel: coreMessages, scope: "web" });

/**
 * Sources for the server: core's email strings plus each plugin's server tree.
 * Deliberately excludes the frontend tree - an API process has no use for admin
 * UI copy, and keeping it out is the whole point of the split.
 */
export const buildApiMessagesSources = (args: {
  appMessages?: AppMessagesMap;
  plugins: { messages?: LocaleMessagesMap; pluginId: string }[];
}): MessagesSource[] =>
  buildSources({ ...args, coreBarrel: coreApiMessages, scope: "api" });
