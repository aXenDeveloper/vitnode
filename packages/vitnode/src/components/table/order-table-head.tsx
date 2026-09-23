import { cn } from "cn";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import React from "react";

import type {
  AlignDataTable,
  DataTableProps,
  DataTableTMin,
} from "./data-table-content";

import { Button } from "../ui/button";
import { Loader } from "../ui/loader";
import { useDataTableUrl } from "./navigation";
import { readTableOrder, toggleTableOrder } from "./url-state";

export function OrderTableHeadDataTable<T extends DataTableTMin>({
  align,
  id,
  children,
  order: { defaultOrder },
}: Pick<DataTableProps<T>, "order"> & {
  align?: AlignDataTable;
  children: React.ReactNode;
  id: keyof T;
}) {
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const column = id.toString();
  const fallback = {
    column: defaultOrder.column.toString(),
    order: defaultOrder.order,
  };
  const current = readTableOrder(searchParams, fallback);
  const isActive = current.column === column;

  let icon: React.ReactNode;
  if (isPending) {
    icon = <Loader small />;
  } else if (isActive) {
    icon = current.order === "asc" ? <ArrowUp /> : <ArrowDown />;
  } else {
    icon = <ChevronsUpDown />;
  }

  return (
    <Button
      className={cn(
        "[&_svg]:text-muted-foreground inline-flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 [&_svg]:size-4 [&_svg]:shrink-0",
        align === "right" ? "-mr-2" : "-ml-2",
      )}
      data-testid={`table-order-${column}`}
      onClick={() => {
        navigate(
          toggleTableOrder(searchParams, { column, defaultOrder: fallback }),
        );
      }}
      size="sm"
      variant="ghost"
    >
      {children}
      {icon}
    </Button>
  );
}
