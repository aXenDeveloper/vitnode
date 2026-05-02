"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React from "react";

import { usePathname, useRouter } from "@/lib/navigation";

import type { DataTable, DataTableTMin } from "./data-table";

import { Button } from "../ui/button";
import { Loader } from "../ui/loader";

export function OrderTableHeadDataTable<T extends DataTableTMin>({
  id,
  children,
  order: { defaultOrder },
}: Pick<React.ComponentProps<typeof DataTable<T>>, "order"> & {
  children: React.ReactNode;
  id: React.ComponentProps<typeof DataTable<T>>["columns"][0]["id"];
}) {
  const [isPending, startTransition] = React.useTransition();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { push } = useRouter();

  const currentOrderBy =
    searchParams.get("orderBy") ?? defaultOrder.column.toString();
  const currentOrder = searchParams.get("order") ?? defaultOrder.order;

  const isActive = currentOrderBy === id.toString();
  const nextOrder = isActive && currentOrder === "asc" ? "desc" : "asc";

  let icon: React.ReactNode;
  if (isPending) {
    icon = <Loader small />;
  } else if (isActive) {
    icon = currentOrder === "asc" ? <ArrowUp /> : <ArrowDown />;
  } else {
    icon = <ChevronsUpDown />;
  }

  return (
    <Button
      className="[&_svg]:text-muted-foreground -ml-2 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 [&_svg]:size-4 [&_svg]:shrink-0"
      onClick={() => {
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("orderBy", id.toString());
          params.set("order", nextOrder);
          push(`${pathname}?${params.toString()}`, {
            scroll: false,
          });
        });
      }}
      size="sm"
      variant="ghost"
    >
      {children}
      {icon}
    </Button>
  );
}
