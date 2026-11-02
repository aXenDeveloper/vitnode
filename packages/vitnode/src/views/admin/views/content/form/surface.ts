import React from "react";

/** Where a generated content form is shown outside its own page. */
export type ContentFormSurface = "dialog" | "sheet";

export const ContentFormSurfaceContext =
  React.createContext<ContentFormSurface>("dialog");

/** The surface the surrounding content form renders in. */
export const useContentFormSurface = () => React.use(ContentFormSurfaceContext);
