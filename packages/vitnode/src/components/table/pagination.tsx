"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import React from "react";

import { usePathname, useRouter } from "@/lib/navigation";

import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export const PaginationDataTable = ({
  pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor },
}: {
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}) => {
  const t = useTranslations("core.global");
  const { push } = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pagination = {
    first: searchParams.get("first"),
    last: searchParams.get("last"),
    cursor: searchParams.get("cursor"),
  };
  const pageSize = pagination.first ?? pagination.last ?? 10;

  return (
    <div className="flex w-full flex-col-reverse items-center justify-end gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8">
        <Select
          disabled={isPending}
          onValueChange={value => {
            if (value == null) {
              return;
            }
            startTransition(() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("first", value as string);
              params.delete("last");
              params.delete("cursor");
              push(`${pathname}?${params.toString()}`, {
                scroll: false,
              });
            });
          }}
          value={`${pageSize}`}
        >
          {isPending ? (
            <Skeleton className="h-9 w-[4.5rem]" />
          ) : (
            <SelectTrigger className="bg-card h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
          )}
          <SelectContent side="top">
            {PAGE_SIZE_OPTIONS.map(pageSize => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          {isPending ? (
            <Skeleton className="size-8" />
          ) : (
            <Button
              aria-label={t("go_to_prev_page")}
              className="bg-card size-8"
              disabled={!hasPreviousPage}
              onClick={() => {
                startTransition(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("last", `${Number(pageSize)}`);
                  if (startCursor) {
                    params.set("cursor", `${startCursor}`);
                  } else {
                    params.delete("cursor");
                  }
                  params.delete("first");
                  push(`${pathname}?${params.toString()}`, {
                    scroll: false,
                  });
                });
              }}
              size="icon"
              variant="outline"
            >
              <ChevronLeftIcon />
            </Button>
          )}

          {isPending ? (
            <Skeleton className="size-8" />
          ) : (
            <Button
              aria-label={t("go_to_next_page")}
              className="bg-card size-8"
              disabled={!hasNextPage || isPending}
              onClick={() => {
                startTransition(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("first", `${Number(pageSize)}`);
                  if (endCursor) {
                    params.set("cursor", `${endCursor}`);
                  } else {
                    params.delete("cursor");
                  }
                  params.delete("last");
                  push(`${pathname}?${params.toString()}`, {
                    scroll: false,
                  });
                });
              }}
              size="icon"
              variant="outline"
            >
              <ChevronRightIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
