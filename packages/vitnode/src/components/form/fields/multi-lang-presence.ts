import React from "react";

/** Who is in each language of one field, for its language switcher. */
export interface MultiLangPresence {
  /** Whether anyone else is in this language. */
  busy: (code: string) => boolean;
  /** The marker shown beside the language's name, `null` when nobody is in it. */
  marker: (code: string) => React.ReactNode;
}

/** Set by a live form; without it the language switcher shows nothing extra. */
export const MultiLangPresenceContext =
  React.createContext<MultiLangPresence | null>(null);

/**
 * Hears which language a multi-language field shows, so a wrapper (a live
 * form's field lock) knows the language without owning the switcher.
 */
export const MultiLangShownLanguageContext = React.createContext<
  ((code: string) => void) | null
>(null);
