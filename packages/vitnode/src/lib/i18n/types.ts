/** One locale's messages, as they come out of a `*.json` locale file. */
export type Messages = Record<string, unknown>;

/**
 * Lazily loads one locale's messages, e.g. `() => import("./en.json")`.
 *
 * The import path has to be a literal. A template literal such as
 * ``() => import(`./${locale}.json`)`` is invisible to TypeScript and to
 * bundlers, so the JSON never reaches the build output - at runtime the import
 * throws and every string silently degrades to its raw key.
 */
export type MessagesLoader = () => Promise<{ default: Messages }>;

/** Every locale a package ships, keyed by locale code. */
export type LocaleMessagesMap = Record<string, MessagesLoader>;

/**
 * App-level additions and overrides, keyed by locale code and then by the
 * plugin whose namespace they extend. Deep-merged last, after every package,
 * so a file only needs the keys it actually changes.
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
}

export interface LocaleConfig {
  code: string;
  name: string;
}

export interface VitNodeI18nConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  defaultLocale: AppLocales[number]["code"];
  localePrefix?: "always" | "as-needed" | "never";
  locales: AppLocales;
  /**
   * Translations owned by the app rather than by a package - a language no
   * plugin ships yet, or a handful of strings you want to word differently.
   * Files live in `src/locales/<pluginId>/<locale>.json`.
   */
  messages?: AppMessagesMap;
  timeZone?: string;
}

/**
 * The API side of {@link VitNodeI18nConfig}. Every field is optional: with no
 * `i18n` block at all the locale list is derived from the languages the
 * installed packages ship, and `defaultLocale` falls back to `en`. Point both
 * `buildConfig` and `buildApiConfig` at the same object when an app serves the
 * web and the API together.
 */
export type VitNodeApiI18nConfig = Partial<VitNodeI18nConfig>;
