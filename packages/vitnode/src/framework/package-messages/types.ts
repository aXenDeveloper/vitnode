/** One package's locale files, as the generator writes them out. */
export interface ResolvedPackageMessagesModule {
  /**
   * Locale code → a literal `*.json` import specifier, already validated and
   * sorted by code.
   */
  localeFiles: Record<string, string>;
  pluginId: string;
}
