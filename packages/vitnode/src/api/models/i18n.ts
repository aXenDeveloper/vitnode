import type { Context } from "hono";

import { createTranslator } from "use-intl";

import type { LocaleConfig, Messages } from "@/lib/i18n/types";

import { loadMessages } from "@/lib/i18n/load-messages";
import { negotiateLocale } from "@/lib/i18n/negotiate-locale";

export type Translator = ReturnType<typeof createTranslator>;

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
