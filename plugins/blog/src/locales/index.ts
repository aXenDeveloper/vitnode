import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

/**
 * Every language this plugin ships. Add a file next to this one and a line
 * here to add another; apps pick it up with no copy step.
 */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
  pl: async () => await import("./pl.json", { with: { type: "json" } }),
};

export default messages;
