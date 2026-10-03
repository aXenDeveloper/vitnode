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
  hasTableCursor,
  readTablePage,
  withTablePage,
  withTablePageNumber,
  withTablePageSize,
} from "./url-state";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

type CursorDirection = "next" | "previous";

interface TableUrlControls {
  navigate: (nextSearch: string) => void;
  searchParams: URLSearchParams;
}

const disabledStepProps = {
  "aria-disabled": true as const,
  className: "pointer-events-none opacity-50",
  role: "link",
  tabIndex: -1,
};

const hrefOf = (nextSearch: string) => (nextSearch ? `?${nextSearch}` : "?");

const linkTo =
  (navigate: TableUrlControls["navigate"], nextSearch: string) =>
  (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(nextSearch);
  };

const PageSizeSelectDataTable = ({
  isPending,
  navigate,
  pageSize,
  searchParams,
}: TableUrlControls & {
  isPending: boolean;
  pageSize: number;
}) => {
  const t = useTranslations("core.global");
  const pageSizes = [...new Set([...PAGE_SIZE_OPTIONS, pageSize])].sort(
    (a, b) => a - b,
  );

  return (
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
  );
};

const CursorPaginationDataTable = ({
  endCursor,
  hasNextPage,
  hasPreviousPage,
  navigate,
  pageSize,
  searchParams,
  startCursor,
}: TableUrlControls & {
  endCursor: null | string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  startCursor: null | string;
}) => {
  const t = useTranslations("core.global");

  const cursorStepProps = (
    direction: CursorDirection,
    cursor: null | string,
    enabled: boolean,
  ) => {
    if (!enabled) return disabledStepProps;

    const nextSearch = withTablePage(searchParams, {
      cursor,
      direction,
      pageSize,
    });

    return { href: hrefOf(nextSearch), onClick: linkTo(navigate, nextSearch) };
  };

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={t("previous")}
            {...cursorStepProps("previous", startCursor, hasPreviousPage)}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            text={t("next")}
            {...cursorStepProps("next", endCursor, hasNextPage)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

const NumberedPaginationDataTable = ({
  hasNextPage,
  hasPreviousPage,
  navigate,
  page,
  searchParams,
  totalPages,
}: TableUrlControls & {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  totalPages: number;
}) => {
  const t = useTranslations("core.global");

  const hrefFor = (nextPage: number) =>
    hrefOf(withTablePageNumber(searchParams, nextPage));
  const goTo = (nextPage: number) =>
    linkTo(navigate, withTablePageNumber(searchParams, nextPage));
  const stepProps = (nextPage: number, enabled: boolean) =>
    enabled
      ? { href: hrefFor(nextPage), onClick: goTo(nextPage) }
      : disabledStepProps;

  return (
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
  );
};

const RangeSummaryDataTable = ({
  count,
  page,
  pageSize,
  totalCount,
}: {
  count: number;
  page: null | number;
  pageSize: number;
  totalCount: number;
}) => {
  const t = useTranslations("core.global");

  if (count === 0) {
    return t("results_not_found");
  }
  if (page == null) {
    return null;
  }

  const from = (page - 1) * pageSize + 1;

  return t("showing_range", { from, to: from + count - 1, total: totalCount });
};

export const PaginationDataTable = ({
  pageInfo: {
    count,
    currentPage,
    endCursor,
    hasNextPage,
    hasPreviousPage,
    pageSize,
    startCursor,
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
  const { isPending, navigate, searchParams } = useDataTableUrl();
  const isCursor = currentPage === null && hasTableCursor(searchParams);
  const page = isCursor ? null : (currentPage ?? readTablePage(searchParams));
  const showCursorPagination = isCursor && (hasPreviousPage || hasNextPage);
  const showNumberedPagination = page != null && totalPages > 1;

  return (
    <div
      aria-busy={isPending}
      className={cn(
        "border-foreground/10 flex w-full flex-col gap-4 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      <p aria-live="polite" className="text-muted-foreground text-sm">
        <RangeSummaryDataTable
          count={count}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6">
        <PageSizeSelectDataTable
          isPending={isPending}
          navigate={navigate}
          pageSize={pageSize}
          searchParams={searchParams}
        />

        {showCursorPagination && (
          <CursorPaginationDataTable
            endCursor={endCursor}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            navigate={navigate}
            pageSize={pageSize}
            searchParams={searchParams}
            startCursor={startCursor}
          />
        )}
        {showNumberedPagination && (
          <NumberedPaginationDataTable
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            navigate={navigate}
            page={page}
            searchParams={searchParams}
            totalPages={totalPages}
          />
        )}
      </div>
    </div>
  );
};
