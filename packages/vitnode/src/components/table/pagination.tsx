"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { useDataTableUrl } from "./navigation";
import {
  readTablePageSize,
  withTablePage,
  withTablePageSize,
} from "./url-state";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export const PaginationDataTable = ({
  pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor },
}: {
  pageInfo: {
    count: number;
    endCursor: null | string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | string;
    totalCount: number;
  };
}) => {
  const t = useTranslations("core.global");
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const pageSize = readTablePageSize(searchParams);

  return (
    <div className="flex w-full flex-col-reverse items-center justify-end gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8">
        <Select
          disabled={isPending}
          onValueChange={value => {
            if (value == null) {
              return;
            }
            navigate(withTablePageSize(searchParams, value as string));
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
                navigate(
                  withTablePage(searchParams, {
                    cursor: startCursor,
                    direction: "previous",
                    pageSize,
                  }),
                );
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
                navigate(
                  withTablePage(searchParams, {
                    cursor: endCursor,
                    direction: "next",
                    pageSize,
                  }),
                );
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
