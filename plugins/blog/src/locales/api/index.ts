import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

/** Server-side messages (notification text), one loader per language. */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
