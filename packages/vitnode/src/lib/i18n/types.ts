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

export interface LocaleConfig {
  code: string;
  enabled?: boolean;
  name: string;
}

export interface VitNodeI18nConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  defaultLocale: AppLocales[number]["code"];
  localePrefix?: "always" | "as-needed" | "never";
  locales: AppLocales;

  messages?: AppMessagesMap;
  timeZone?: string;
}

export type VitNodeApiI18nConfig = Partial<VitNodeI18nConfig>;
