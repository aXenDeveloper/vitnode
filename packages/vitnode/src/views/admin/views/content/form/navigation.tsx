// No "use client", for the same reason `transport.tsx` has none: this is only
// reached from a client entry, and a nested one cannot be resolved from inside
// a published package.
import React from "react";

import type { ContentFormLinkComponent } from "./context";

export interface ContentFormNavigation {
  LinkComponent: ContentFormLinkComponent;

  navigate: (href: string) => void;

  refresh: () => void;
}

const ContentFormNavigationContext =
  React.createContext<ContentFormNavigation | null>(null);

export const ContentFormNavigationProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ContentFormNavigation;
}) => (
  <ContentFormNavigationContext.Provider value={value}>
    {children}
  </ContentFormNavigationContext.Provider>
);

/** The message a caller gets when a host forgot to mount the provider. */
export const CONTENT_FORM_NAVIGATION_MISSING =
  "A Content Engine screen must be rendered inside a ContentFormNavigationProvider. A TanStack Start route mounts one in ContentFormHost.";

export const useContentFormNavigation = (): ContentFormNavigation => {
  const navigation = React.use(ContentFormNavigationContext);

  if (!navigation) throw new Error(CONTENT_FORM_NAVIGATION_MISSING);

  return navigation;
};
