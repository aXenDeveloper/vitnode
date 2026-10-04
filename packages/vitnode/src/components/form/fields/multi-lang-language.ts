import React from "react";

export const MultiLangLanguageContext = React.createContext<null | string>(
  null,
);

export const useMultiLangLanguage = (): null | string =>
  React.use(MultiLangLanguageContext);

/**
 * The language a multi-language field is currently showing, offered to what
 * renders in its label slot - an AI button, for example, that must write into
 * the language the editor is looking at. Read-only: it never locks anything.
 */
export const MultiLangSelectedContext = React.createContext<null | string>(
  null,
);

export const useMultiLangSelected = (): null | string =>
  React.use(MultiLangSelectedContext);
