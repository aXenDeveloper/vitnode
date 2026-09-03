"use client";

import React from "react";

export interface DataTableNavigation {
  navigate: (nextSearch: string) => Promise<void> | void;
  /** The query string the table is currently rendering. Never mutated. */
  searchParams: URLSearchParams;
}

const DataTableNavigationContext =
  React.createContext<DataTableNavigation | null>(null);

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
