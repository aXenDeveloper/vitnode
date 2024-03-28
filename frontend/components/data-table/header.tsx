import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { HeaderContext } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "../ui/button";
import { usePathname, useRouter } from "@/i18n";

interface Props<T> extends HeaderContext<T, unknown> {
  children: ReactNode;
}

export function HeaderSortingDataTable<T>({
  children,
  column,
  table
}: Props<T>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { push } = useRouter();
  const defaultSortingState = table.getState().sorting;

  const icon = () => {
    const getSortDirectionIcon = (direction: string) => {
      return direction === "asc" ? <ArrowUp /> : <ArrowDown />;
    };

    const sortBy = searchParams.get("sortBy");
    const sortDirection = searchParams.get("sortDirection");

    if (defaultSortingState[0].id === column.id && !sortBy) {
      return getSortDirectionIcon(defaultSortingState[0].desc ? "desc" : "asc");
    }

    if (column.id === sortBy && sortDirection) {
      return getSortDirectionIcon(sortDirection);
    }

    return <ArrowUpDown />;
  };

  return (
    <Button
      variant="ghost"
      className="-ml-3"
      size="sm"
      onClick={() => {
        const params = new URLSearchParams(searchParams);
        params.set("sortBy", column.id);

        const sortDirection = () => {
          if (
            column.id === searchParams.get("sortBy") &&
            searchParams.get("sortDirection")
          ) {
            return searchParams.get("sortDirection") === "asc" ? "desc" : "asc";
          }

          return defaultSortingState[0].desc ? "asc" : "desc";
        };
        params.set("sortDirection", sortDirection());
        params.delete("cursor");
        params.delete("first");
        params.delete("last");

        push(`${pathname}?${params.toString()}`);
      }}
    >
      {children}
      {icon()}
    </Button>
  );
}
