import type {
  AppMessagesMap,
  LocaleMessagesMap,
  MessagesSource,
} from "@vitnode/api/lib/i18n/types";

import { buildScopedMessagesSources } from "@vitnode/api/lib/i18n/sources";

import coreMessages from "@/locales";

export {
  buildApiMessagesSources,
  buildAppMessagesSources,
  buildScopedMessagesSources,
} from "@vitnode/api/lib/i18n/sources";

/** Sources for the frontend: core's UI strings plus each plugin's UI tree. */
export const buildMessagesSources = (args: {
  appMessages?: AppMessagesMap;
  plugins: { messages?: LocaleMessagesMap; pluginId: string }[];
}): MessagesSource[] =>
  buildScopedMessagesSources({
    ...args,
    coreBarrel: coreMessages,
    scope: "web",
  });
