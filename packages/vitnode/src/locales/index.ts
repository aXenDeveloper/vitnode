import type { LocaleMessagesMap } from "@/lib/i18n/types";

/**
 * Every language `@vitnode/core` ships to the *frontend*. Add a file next to
 * this one and a line here to add another; apps pick it up with no copy step.
 * Server-only strings (emails) live in the sibling `api/` barrel instead, so an
 * API-only app never loads the admin UI's messages.
 *
 * Only `en` is complete. Every other file translates the strings VitNode's own
 * pages render and deliberately stops there - `loadMessages` puts the default
 * locale underneath as a per-key fallback, so a half-translated language renders
 * English for the keys it leaves out rather than showing `core.global.close`.
 * An installation reworded a string by overriding it in its own `src/locales`,
 * not by completing a file here.
 *
 * The annotation is deliberate - inferring it would inline the whole message
 * tree into the emitted `.d.ts`. Key-level types come from the `next-intl`
 * augmentation in `global.d.ts`.
 */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
  pl: async () => await import("./pl.json", { with: { type: "json" } }),
};

export default messages;
