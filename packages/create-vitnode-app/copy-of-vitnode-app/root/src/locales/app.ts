import type { AppMessagesMap } from "@vitnode/core/lib/i18n/types";

export const appMessages: AppMessagesMap = {
  en: {
    app: async () => await import("./app/en.json"),
  },
};
