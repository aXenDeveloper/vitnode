import { CONFIG_PLUGIN } from "@/config";
import coreMessages from "@/locales";

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
 * The ordered list of everything that contributes translations: core first,
 * then each installed plugin, then whatever the app overrides. Later sources
 * win, so an app can reword a core string without forking it.
 */
export const buildMessagesSources = ({
  appMessages,
  plugins,
}: {
  appMessages?: AppMessagesMap;
  plugins: { messages?: LocaleMessagesMap; pluginId: string }[];
}): MessagesSource[] => [
  { id: CONFIG_PLUGIN.pluginId, messages: coreMessages },
  ...plugins.map(plugin => ({
    id: plugin.pluginId,
    messages: plugin.messages,
  })),
  ...appMessagesToSources(appMessages),
];
