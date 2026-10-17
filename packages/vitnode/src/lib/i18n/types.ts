/** One locale's messages, as they come out of a `*.json` locale file. */
export type Messages = Record<string, unknown>;

export type MessagesLoader = () => Promise<{ default: Messages }>;

/** Every locale a package ships, keyed by locale code. */
export type LocaleMessagesMap = Record<string, MessagesLoader>;

/**
 * Every locale file a package ships, keyed by locale code - each value a
 * literal `*.json` import specifier an app's bundler can follow.
 *
 * Declarative on purpose: this is the half of a package's translations that
 * travels through the browser-safe plugin factory, so it holds no loader and
 * no code. VitNode's Vite plugin writes the loaders from it, into the app's
 * own `src/package-messages.gen.ts`, where the specifiers are literals the
 * bundler resolves at build time.
 */
export type LocaleFilesMap = Record<string, string>;

/**
 * An app's own translations: keyed by locale, then by namespace - a package id
 * such as `@vitnode/core` to override that package's strings, or a namespace
 * of the app's own. Merged over the packages' messages, so a key the app sets
 * wins.
 */
export type AppMessagesMap = Record<string, Record<string, MessagesLoader>>;

/** A package - core or a plugin - contributing messages to the merged tree. */
export interface MessagesSource {
  id: string;
  messages?: LocaleMessagesMap;
  /**
   * Set for app-level overrides, which only carry the strings they change and
   * so are not expected to cover the default locale.
   */
  optional?: boolean;

  scope?: string;
}

/** One language the app offers. */
export interface LocaleConfig {
  /** The locale code used in URLs and message lookups, e.g. `en` or `pl`. */
  code: string;
  /** `false` switches the locale off: its URLs stop routing. Defaults to `true`. */
  enabled?: boolean;
  /** The language's own name, shown in the language switcher. */
  name: string;
}

/** A host that serves its own locales, e.g. `https://vitnode.pl` for Polish. */
export interface LocaleDomainConfig<TLocale extends string = string> {
  /** The locale this host serves without a prefix. */
  defaultLocale: TLocale;
  /** Every locale the host serves. Defaults to `[defaultLocale]`. */
  locales?: TLocale[];
  /** Scheme and host only, e.g. `https://vitnode.pl` - no path, query or credentials. */
  origin: string;
}

/**
 * Translated URL paths, per locale: canonical route path to localized path,
 * with the same parameters - `{ pl: { "/blog/:slug": "/wpisy/:slug" } }`.
 */
export type LocaleRoutePaths<TLocale extends string = string> = Partial<
  Record<TLocale, Record<string, string>>
>;

/** An app's languages and how locales appear in URLs. */
export interface VitNodeI18nConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** The fallback locale, and the one served without a prefix under `"as-needed"`. */
  defaultLocale: AppLocales[number]["code"];
  /**
   * Serves locales from separate hosts. An invalid origin, or a locale claimed
   * twice, throws when locale routing is built.
   */
  domains?: LocaleDomainConfig<AppLocales[number]["code"]>[];
  /**
   * How the locale appears in public URLs. `"as-needed"` (the default) leaves
   * the default locale unprefixed; `"always"` prefixes every locale; `"never"`
   * prefixes none, which needs `domains` when more than one locale is enabled.
   * `/admin` and `/api` are never prefixed.
   */
  localePrefix?: "always" | "as-needed" | "never";
  /** Every language the app offers. */
  locales: AppLocales;

  /** The API's message overrides; a web app passes its own to `buildServerConfig`. */
  messages?: AppMessagesMap;
  /** Translated URL paths per locale. */
  routePaths?: LocaleRoutePaths<AppLocales[number]["code"]>;
  /** IANA time zone for formatting dates, e.g. `Europe/Warsaw`. Defaults to `UTC`. */
  timeZone?: string;
}

/** The API's `i18n` block: the same shape, every field optional. */
export type VitNodeApiI18nConfig = Partial<VitNodeI18nConfig>;
