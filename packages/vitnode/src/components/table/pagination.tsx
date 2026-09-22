import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useDataTableUrl } from "./navigation";
import { tablePageWindow } from "./page-window";
import {
  readTablePage,
  withTablePageNumber,
  withTablePageSize,
} from "./url-state";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export const PaginationDataTable = ({
  pageInfo: {
    count,
    currentPage,
    hasNextPage,
    hasPreviousPage,
    pageSize,
    totalCount,
    totalPages,
  },
}: {
  pageInfo: {
    count: number;
    currentPage: null | number;
    endCursor: null | string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageSize: number;
    startCursor: null | string;
    totalCount: number;
    totalPages: number;
  };
}) => {
  const t = useTranslations("core.global");
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const page = currentPage ?? readTablePage(searchParams);
  const pageSizes = [...new Set([...PAGE_SIZE_OPTIONS, pageSize])].sort(
    (a, b) => a - b,
  );

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = count === 0 ? 0 : from + count - 1;

  const searchFor = (nextPage: number) =>
    withTablePageNumber(searchParams, nextPage);
  const hrefFor = (nextPage: number) => {
    const next = searchFor(nextPage);

    return next ? `?${next}` : "?";
  };
  const goTo =
    (nextPage: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      navigate(searchFor(nextPage));
    };

  const stepProps = (nextPage: number, enabled: boolean) =>
    enabled
      ? { href: hrefFor(nextPage), onClick: goTo(nextPage) }
      : {
          "aria-disabled": true as const,
          className: "pointer-events-none opacity-50",
          tabIndex: -1,
        };

  return (
    <div
      aria-busy={isPending}
      className={cn(
        "border-foreground/10 flex w-full flex-col gap-4 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {count === 0
          ? t("results_not_found")
          : t("showing_range", { from, to, total: totalCount })}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6">
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
          <SelectTrigger
            aria-label={t("rows_per_page")}
            className="bg-card h-8 w-18"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizes.map(option => (
              <SelectItem key={option} value={`${option}`}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text={t("previous")}
                  {...stepProps(page - 1, hasPreviousPage)}
                />
              </PaginationItem>

              <PaginationItem className="sm:hidden">
                <span className="text-muted-foreground px-2 text-sm">
                  {t("page_of", { page, total: totalPages })}
                </span>
              </PaginationItem>

              {tablePageWindow({ current: page, total: totalPages }).map(
                (slot, index) => (
                  <PaginationItem
                    className="hidden sm:block"
                    key={
                      slot === "ellipsis"
                        ? `gap-${index === 1 ? "start" : "end"}`
                        : slot
                    }
                  >
                    {slot === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href={hrefFor(slot)}
                        isActive={slot === page}
                        onClick={goTo(slot)}
                      >
                        {slot}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  text={t("next")}
                  {...stepProps(page + 1, hasNextPage)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
};
