import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

/** Strings the API renders - notifications and their emails. */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
