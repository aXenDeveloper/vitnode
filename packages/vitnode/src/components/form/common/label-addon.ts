import React from "react";

/**
 * Something shown beside a field's label - who else is in the field, in a live
 * form. Decorative: the field tells assistive technology the same thing some
 * other way.
 */
export const AutoFormLabelAddonContext =
  React.createContext<React.ReactNode>(null);
