import React from "react";

export interface MultiLangPresence {
  busy: (code: string) => boolean;
  marker: (code: string) => React.ReactNode;
}

export const MultiLangPresenceContext =
  React.createContext<MultiLangPresence | null>(null);

export const MultiLangShownLanguageContext = React.createContext<
  ((code: string) => void) | null
>(null);
