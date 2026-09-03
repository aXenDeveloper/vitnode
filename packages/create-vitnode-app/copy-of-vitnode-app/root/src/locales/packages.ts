import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

import { CONFIG_PLUGIN as CORE } from "@vitnode/core/config";


export const packageMessages: Record<string, LocaleMessagesMap> = {
  [CORE.pluginId]: {
    en: async () => await import("@vitnode/core/locales/en.json"),
  },
};
