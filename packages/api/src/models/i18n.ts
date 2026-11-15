import type { Context } from "hono";

import { createTranslator } from "use-intl";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type { LocaleConfig, Messages } from "@/lib/i18n/types";

import { loadMessages } from "@/lib/i18n/load-messages";
import { negotiateLocale } from "@/lib/i18n/negotiate-locale";

export type Translator = ReturnType<typeof createTranslator>;

/**
 * Server-side translations, read in a route as `c.get("i18n")`. For output with
 * no UI only, such as emails - API responses return i18n keys and let the web
 * translate them.
 */
export class I18nModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  /** The merged messages of core, every plugin and the app for a locale (see {@link I18nModel.resolveLocale}). */
  async getMessages(locale?: string): Promise<Messages> {
    const core = this.c.get("core");

    return await loadMessages({
      defaultLocale: core.i18n.defaultLocale,
      locale: this.resolveLocale(locale),
      sources: core.i18n.sources,
    });
  }

  /**
   * A `use-intl` translator for a locale (see {@link I18nModel.resolveLocale}).
   *
   * @example
   * ```ts
   * const i18n = c.get("i18n");
   * // The recipient's language, not the request's.
   * const t = await i18n.getTranslator(i18n.resolveSupportedLocale(recipient.language));
   * ```
   */
  async getTranslator(locale?: string): Promise<Translator> {
    const resolved = this.resolveLocale(locale);

    return createTranslator({
      locale: resolved,
      messages: await this.getMessages(resolved),
    });
  }

  /**
   * The locale for this request: `explicit` when offered, else the signed-in
   * user's language, else the best `Accept-Language` match, else the default.
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
   * `preferred` when offered, else the default locale - never the request's
   * language. For output addressed to someone else, such as an email.
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

  get localeRouting(): LocaleRouting {
    return this.c.get("core").i18n.localeRouting;
  }

  get locales(): LocaleConfig[] {
    return this.c.get("core").i18n.locales;
  }
}
