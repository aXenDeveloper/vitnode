import React from "react";

/**
 * Pins every multi-language field below it to one language and hides their
 * language switchers - e.g. a side-by-side translation view rendering the
 * source and target languages separately.
 */
export const MultiLangLanguageContext = React.createContext<null | string>(
  null,
);

/** The pinned language from {@link MultiLangLanguageContext}, or `null`. */
export const useMultiLangLanguage = (): null | string =>
  React.use(MultiLangLanguageContext);

/**
 * The language a multi-language field is showing, provided to its label's
 * `labelRight` content and to a multi-language editor's body (e.g. AI assist
 * acting on that language).
 */
export const MultiLangSelectedContext = React.createContext<null | string>(
  null,
);

/** The language from {@link MultiLangSelectedContext}, or `null` outside a multi-language field. */
export const useMultiLangSelected = (): null | string =>
  React.use(MultiLangSelectedContext);
