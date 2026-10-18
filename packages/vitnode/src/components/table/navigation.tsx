import React from "react";

/**
 * How a data table reads and writes the URL. Sorting, paging, search and
 * filters all live in the query string, so the host decides how a change
 * navigates (e.g. TanStack Router's `navigate({ search })`).
 */
export interface DataTableNavigation {
  /** Navigates to the given query string. Runs inside a React transition. */
  navigate: (nextSearch: string) => Promise<void> | void;
  /** The query string the table is currently rendering. Never mutated. */
  searchParams: URLSearchParams;
}

const DataTableNavigationContext =
  React.createContext<DataTableNavigation | null>(null);

/** Provides {@link DataTableNavigation} to every data table control below it. Required by `ContentDataTable`. */
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
 * The table's current query string and a `navigate` wrapped in a transition,
 * whose `isPending` controls can show while the next page loads.
 *
 * @throws Outside a {@link DataTableNavigationProvider}.
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
