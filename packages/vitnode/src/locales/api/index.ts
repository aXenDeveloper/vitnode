import type { LocaleMessagesMap } from "@/lib/i18n/types";

/**
 * The languages `@vitnode/core` ships for the *server* - the strings emails and
 * other server-rendered responses use, kept apart from the frontend tree in
 * `../index.ts` so an API-only app never loads the admin UI's messages.
 *
 * Same shape as the frontend barrel: a file next to this one per language, one
 * line here. See `src/locales/index.ts` for why the annotation is explicit.
 */
const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
