import React from "react";

/** Who else is editing which language of a field, for its language switcher. */
export interface MultiLangPresence {
  /** Whether someone else is editing this language; marks the switcher. */
  busy: (code: string) => boolean;
  /** Rendered next to each language in the switcher's list. */
  marker: (code: string) => React.ReactNode;
}

/** Provided by Content Engine live editing; `null` elsewhere. */
export const MultiLangPresenceContext =
  React.createContext<MultiLangPresence | null>(null);

/** Receives the language a multi-language field is showing, whenever it changes. */
export const MultiLangShownLanguageContext = React.createContext<
  ((code: string) => void) | null
>(null);
