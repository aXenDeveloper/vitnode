import type { LocaleMessagesMap } from "@/lib/i18n/types";

const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
