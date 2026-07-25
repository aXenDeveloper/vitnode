import type { LocaleMessagesMap } from "@/lib/i18n/types";

/**
 * Every language `@vitnode/core` ships. Add a file next to this one and a line
 * here to add another; apps pick it up with no copy step.
 *
 * The annotation is deliberate - inferring it would inline the whole message
 * tree into the emitted `.d.ts`. Key-level types come from the `next-intl`
 * augmentation in `global.d.ts`.
 */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
