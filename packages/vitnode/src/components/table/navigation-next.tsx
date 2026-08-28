"use client";

import { useSearchParams } from "next/navigation";
import React from "react";

import { usePathname, useRouter } from "@/lib/navigation";

import type { DataTableNavigation } from "./navigation";

import { DataTableNavigationProvider } from "./navigation";

/**
 * {@link DataTableNavigationProvider}, wired to Next.js.
 *
 * The whole of the framework coupling the data table used to spread across four
 * control components, in one place: the current search parameters, the pathname
 * `next-intl` has already stripped the locale prefix from, and a push that does
 * not scroll. `DataTable` mounts this, so every existing page keeps the
 * behaviour it had without knowing anything changed.
 *
 * `usePathname` is the locale-aware one on purpose. `next/navigation`'s returns
 * `/pl/files`, and pushing that through a router that prefixes the locale again
 * gives `/pl/pl/files`.
 */
export const NextDataTableNavigation = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { push } = useRouter();

  const value = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: nextSearch => {
        push(`${pathname}?${nextSearch}`, { scroll: false });
      },
      searchParams,
    }),
    [pathname, push, searchParams],
  );

  return (
    <DataTableNavigationProvider value={value}>
      {children}
    </DataTableNavigationProvider>
  );
};
