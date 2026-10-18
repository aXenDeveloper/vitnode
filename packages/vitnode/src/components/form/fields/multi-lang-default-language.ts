import React from "react";

/**
 * The language a multi-language field falls back to when picking which
 * language to show first. The Content Engine form provides the content type's
 * `defaultLocale`.
 */
export const MultiLangDefaultLanguageContext = React.createContext<
  null | string
>(null);

/** The language from {@link MultiLangDefaultLanguageContext}, or `null`. */
export const useMultiLangDefaultLanguage = (): null | string =>
  React.use(MultiLangDefaultLanguageContext);
