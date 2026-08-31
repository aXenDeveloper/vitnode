// No "use client", for the same reason `transport.tsx` has none: this is only
// reached from a client entry, and a nested one cannot be resolved from inside
// a published package.
import React from "react";

import type { ContentFormLinkComponent } from "./context";

/**
 * The three things a Content Engine screen cannot decide for itself.
 *
 * Everything a form does after a successful write is one of these, and all three
 * are the framework's to answer:
 *
 *     LinkComponent   how a href becomes a navigation the user can click
 *     navigate        how a href becomes a navigation the form performs
 *     refresh         how the screen is made to reflect a write that committed
 *
 * Deliberately three members and no more. A content screen never needs a
 * pathname, a locale, params, prefetching or history state, so widening this is
 * a decision somebody has to make on purpose rather than one that leaks in. It
 * is not a router - the same rule `DataTableNavigation` states, for the same
 * reason.
 *
 * ## Why `refresh` rather than `push(pathname)`
 *
 * The Next.js screens spelled it `push(pathname)`: navigating to where you
 * already are is how an App Router page refetches its RSC payload. That is a
 * Next.js idiom and not a portable instruction - a TanStack Start route asked to
 * navigate to its own href does nothing at all, because the location did not
 * change. So the seam names the *intent* and each host spells it: `push` in
 * Next.js, `router.invalidate()` under TanStack Start, where the query cache has
 * already been expired by the transport.
 */
export interface ContentFormNavigation {
  /**
   * The host's link component.
   *
   * Required rather than defaulting to `<a>`: a missing wrapper degrades
   * silently into a full document reload, which looks like a slow AdminCP rather
   * than a forgotten binding. It reaches the form's own primitives through
   * `ContentFormContext.LinkComponent`, so a plugin's custom layout renders
   * under either router without knowing which one it is in.
   */
  LinkComponent: ContentFormLinkComponent;
  /**
   * Goes to a href inside the AdminCP.
   *
   * One caller: a page-mode create, which lands on the new record's own edit
   * page. Implementations must not scroll-restore or replace history - this is
   * a forward navigation and the browser's back button should return to the
   * blank create form.
   */
  navigate: (href: string) => void;
  /**
   * Makes the current screen reflect a write that has already committed.
   *
   * Called after every successful mutation, including the ones that leave the
   * form open. It must not remount the form: a page-mode edit stays on screen
   * with its values, and a conflict banner or an in-flight upload would be lost.
   */
  refresh: () => void;
}

const ContentFormNavigationContext =
  React.createContext<ContentFormNavigation | null>(null);

/**
 * Context rather than props, and not by preference.
 *
 * In Next.js the content screen is assembled by Server Components: the list
 * view, the create page view and the edit page view all render on the server,
 * and a `navigate` function cannot cross that boundary as a prop. The
 * components that need it - the form, the create button, the row's edit button -
 * are client components several levels down, so the value is created on the
 * client and read from there. The same shape `DataTableNavigationProvider`
 * already uses, for the same reason.
 */
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
