import type { Context } from "hono";

import { createTranslator } from "next-intl";

import type { LocaleConfig, Messages } from "@/lib/i18n/types";

import { loadMessages } from "@/lib/i18n/load-messages";
import { negotiateLocale } from "@/lib/i18n/negotiate-locale";

export type Translator = ReturnType<typeof createTranslator>;

/**
 * Server-side translations, reachable in any route as `c.get("i18n")`.
 *
 * ```ts
 * const t = await c.get("i18n").getTranslator();
 * t("core.auth.reset_password.email.subject");
 * ```
 *
 * Messages come straight from the installed packages - core, then each plugin,
 * then the app's own overrides - and are memoised per locale, so after the
 * first call this is a map lookup.
 */
export class I18nModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async getMessages(locale?: string): Promise<Messages> {
    const core = this.c.get("core");

    return await loadMessages({
      defaultLocale: core.i18n.defaultLocale,
      locale: this.resolveLocale(locale),
      sources: core.i18n.sources,
    });
  }

  async getTranslator(locale?: string): Promise<Translator> {
    const resolved = this.resolveLocale(locale);

    return createTranslator({
      locale: resolved,
      messages: await this.getMessages(resolved),
    });
  }

  /**
   * Picks the locale for this request: an explicit choice first, then the
   * signed-in user's language, then `Accept-Language`, then the default.
   * Anything the app does not list as a locale is skipped.
   *
   * This is the locale of the *caller*. When you are rendering for someone
   * else - an email recipient, a queued job's target - use
   * {@link resolveSupportedLocale} instead.
   */
  resolveLocale(explicit?: string): string {
    const supported = this.locales.map(locale => locale.code);

    if (explicit && supported.includes(explicit)) return explicit;

    const userLanguage = this.c.get("user")?.language;
    if (userLanguage && supported.includes(userLanguage)) return userLanguage;

    return (
      negotiateLocale(this.c.req.header("accept-language"), supported) ??
      this.defaultLocale
    );
  }

  /**
   * Narrows a locale that belongs to the thing being rendered - a recipient's
   * `core_users.language`, a subscriber's saved language - down to one the app
   * ships, falling back to {@link defaultLocale}.
   *
   * Unlike {@link resolveLocale} this never reads the request. Dropping a
   * language from `i18n.locales` must not make that user's mail arrive in
   * whatever language the admin who triggered the send happens to browse in.
   */
  resolveSupportedLocale(preferred?: string): string {
    const supported = this.locales.map(locale => locale.code);

    return preferred && supported.includes(preferred)
      ? preferred
      : this.defaultLocale;
  }

  get defaultLocale(): string {
    return this.c.get("core").i18n.defaultLocale;
  }

  get locales(): LocaleConfig[] {
    return this.c.get("core").i18n.locales;
  }
}
