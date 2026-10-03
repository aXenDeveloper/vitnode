import React from "react";

export const MultiLangLanguageContext = React.createContext<null | string>(
  null,
);

export const useMultiLangLanguage = (): null | string =>
  React.use(MultiLangLanguageContext);
