import React from "react";

export type AutoFormFileDisplay = "card" | "cover";

export const AutoFormFileDisplayContext =
  React.createContext<AutoFormFileDisplay>("card");
