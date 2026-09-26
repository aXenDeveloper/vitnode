import React from "react";

export const MultiLangDefaultLanguageContext = React.createContext<
  null | string
>(null);

export const useMultiLangDefaultLanguage = (): null | string =>
  React.use(MultiLangDefaultLanguageContext);
