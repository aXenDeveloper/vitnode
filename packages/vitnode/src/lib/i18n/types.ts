/** One locale's messages, as they come out of a `*.json` locale file. */
export type Messages = Record<string, unknown>;

export type MessagesLoader = () => Promise<{ default: Messages }>;

/** Every locale a package ships, keyed by locale code. */
export type LocaleMessagesMap = Record<string, MessagesLoader>;

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
