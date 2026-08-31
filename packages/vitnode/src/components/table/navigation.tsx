"use client";

import React from "react";

/**
 * The one thing a `DataTable` cannot decide for itself.
 *
 * Every control in the table turns the current query string into a new one - a
 * pure function, in `url-state.ts` - and then has to get the page there. That
 * last step is the single question whose answer differs between the two
 * frameworks: Next.js wants `next-intl`'s locale-aware router pointed at a
 * pathname it has to look up, TanStack Start wants `router.navigate` and no
 * pathname at all. Both can be expressed as "here is the search string, and
 * here is a function that goes to it", so the table takes those two and stops
 * caring.
 *
 * Deliberately two members and no more. A table needs to read its own search
 * parameters and to replace them; it never needs a pathname, a locale, params,
 * prefetching or history state, so widening this later is a decision somebody
 * has to make on purpose rather than one that leaks in. It is not a router.
 */
export interface DataTableNavigation {
  /**
   * Goes to `nextSearch` - a query string with no leading `?`, exactly as
   * `URLSearchParams.toString()` produces it.
   *
   * Implementations must not scroll: a person sorting the last column of a long
   * table is looking at the header they clicked, and yanking them to the top of
   * the page loses their place.
   *
   * Returning a promise is optional and only affects the pending indicator.
   * Next's `push` resolves through the transition it was called in, so it
   * returns nothing; a router whose `navigate` is awaitable should return it, so
   * the spinner lasts as long as the navigation does instead of flashing.
   */
  navigate: (nextSearch: string) => Promise<void> | void;
  /** The query string the table is currently rendering. Never mutated. */
  searchParams: URLSearchParams;
}

const DataTableNavigationContext =
  React.createContext<DataTableNavigation | null>(null);

/**
 * Context rather than props, and not by preference.
 *
 * In Next.js the table is assembled by a Server Component: `DataTable` renders
 * on the server, and a `navigate` function cannot cross that boundary as a prop.
 * The controls that need it are client components several levels down, so the
 * value has to be created on the client and read from there - the same shape
 * `SelectionProviderDataTable` already uses, for the same reason.
 */
export const DataTableNavigationProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DataTableNavigation;
}) => (
  <DataTableNavigationContext.Provider value={value}>
    {children}
  </DataTableNavigationContext.Provider>
);

/**
 * The seam, as a control sees it: where the table is, and how to move it.
 *
 * The transition is here rather than in each control because every one of them
 * wants the same thing from it - a pending flag to swap a spinner in for while
 * the next page is fetched - and because it is what keeps the old rows on
 * screen instead of blanking the table mid-navigation.
 *
 * `navigate` is awaited inside the transition so that a router returning a
 * promise keeps the control pending for the whole navigation. Awaiting a
 * `void` return costs one microtask and changes nothing: the navigation itself
 * was already started synchronously, inside the transition.
 *
 * The one it hands back returns nothing, deliberately. A control has no use for
 * the navigation's promise - that is what `isPending` is for - and typing it as
 * awaitable would make every call site a floating promise.
 */
export const useDataTableUrl = (): {
  isPending: boolean;
  navigate: (nextSearch: string) => void;
  searchParams: URLSearchParams;
} => {
  const navigation = React.use(DataTableNavigationContext);

  if (!navigation) {
    throw new Error(
      "A DataTable control must be rendered inside a DataTableNavigationProvider.",
    );
  }

  const { navigate, searchParams } = navigation;
  const [isPending, startTransition] = React.useTransition();

  const navigateInTransition = React.useCallback(
    (nextSearch: string) => {
      startTransition(async () => {
        await navigate(nextSearch);
      });
    },
    [navigate],
  );

  return { isPending, navigate: navigateInTransition, searchParams };
};
