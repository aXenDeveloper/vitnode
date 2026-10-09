import React from "react";

export const MultiLangLanguageContext = React.createContext<null | string>(
  null,
);

export const useMultiLangLanguage = (): null | string =>
  React.use(MultiLangLanguageContext);

export const MultiLangSelectedContext = React.createContext<null | string>(
  null,
);

export const useMultiLangSelected = (): null | string =>
  React.use(MultiLangSelectedContext);
