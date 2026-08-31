import type { LocaleMessagesMap } from "@/lib/i18n/types";

/**
 * Every language `@vitnode/core` ships to the *frontend*. Add a file next to
 * this one and a line here to add another; apps pick it up with no copy step.
 * Server-only strings (emails) live in the sibling `api/` barrel instead, so an
 * API-only app never loads the admin UI's messages.
 *
 * Only `en` is complete, and no other file has to be. `loadMessages` puts the
 * default locale underneath as a per-key fallback, so a partial language renders
 * English for the keys it leaves out rather than showing `core.global.close`.
 *
 * These are the *canonical* translations, which is the whole reason they live
 * here rather than in each app: an app that carries its own copy of a language
 * this package already ships is an app whose Polish silently diverges from
 * everyone else's, and while two VitNode frontends run side by side that
 * divergence is visible in one product. An installation reworders a string by
 * overriding that one key in its own `src/locales`, never by forking a file.
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
