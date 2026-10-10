import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

import type { ContentListFilterValue, ContentListSearch } from "./list-page";

import { nextContentListSearch } from "./list-page";

/** A responsive grid of records: one column on phones, up to three on desktop. */
export const ContentList = ({
  className,
  ...props
}: React.ComponentProps<"ul">) => (
  <ul
    className={cn(
      "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
      className,
    )}
    data-slot="content-list"
    {...props}
  />
);

export const ContentListItem = ({
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    className={cn("flex", className)}
    data-slot="content-list-item"
    {...props}
  />
);

export interface ContentCardImage {
  alt: string;
  height?: null | number;
  src: string;
  width?: null | number;
}

/**
 * One record in a list: an optional image, a line of meta such as the date,
 * the title linking to the record's page and a short description.
 *
 * Only the title is a link for assistive technology. The image links to the
 * same page for pointer users but is hidden from the tab order, so a keyboard
 * user does not reach every record twice.
 */
export const ContentCard = ({
  className,
  description,
  headingLevel = 2,
  href,
  image,
  meta,
  title,
}: {
  className?: string;
  description?: null | string;
  headingLevel?: 2 | 3;
  /** The record's internal path, such as `/blog/hello-world`. */
  href: string;
  image?: ContentCardImage | null;
  meta?: React.ReactNode;
  title: string;
}) => {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article
      className={cn(
        "bg-card text-card-foreground flex w-full flex-col overflow-hidden rounded-lg border",
        className,
      )}
      data-slot="content-card"
    >
      {image ? (
        <Link aria-hidden="true" tabIndex={-1} to={href}>
          <img
            alt={image.alt}
            className="bg-muted aspect-video w-full object-cover"
            height={image.height ?? undefined}
            loading="lazy"
            src={image.src}
            width={image.width ?? undefined}
          />
        </Link>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {meta ? (
          <div className="text-muted-foreground text-sm leading-relaxed">
            {meta}
          </div>
        ) : null}

        <Heading className="text-lg leading-snug font-semibold text-balance">
          <Link
            className="focus-visible:ring-ring/50 rounded-sm outline-none hover:underline focus-visible:ring-3"
            to={href}
          >
            {title}
          </Link>
        </Heading>

        {description ? (
          <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty">
            {description}
          </p>
        ) : null}
      </div>
    </article>
  );
};

/** What a list shows when it has no records, or no records match. */
export const ContentListEmpty = ({
  className,
  description,
  title,
}: {
  className?: string;
  description?: string;
  title?: string;
}) => {
  const t = useTranslations("core.global");

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
      data-slot="content-list-empty"
      role="status"
    >
      <p className="text-foreground font-medium text-balance">
        {title ?? t("no_results.title")}
      </p>
      <p className="text-muted-foreground leading-relaxed text-pretty">
        {description ?? t("no_results.desc")}
      </p>
    </div>
  );
};

const PAGE_WINDOW = 1;

/**
 * The router marks a link active - and sets its `aria-current` - when its
 * search is a subset of the current one, so "All" would be current under every
 * filter. Exact matching makes the router agree with the list's own state.
 */
const EXACT_MATCH = { exact: true } as const;

/**
 * The page numbers to show, with `null` where an ellipsis goes.
 *
 * Always the first and the last page, plus the neighbours of the current one,
 * so a list of 40 pages still fits on a phone.
 */
export const contentListPageNumbers = (
  page: number,
  totalPages: number,
): (null | number)[] => {
  const numbers: (null | number)[] = [];

  for (let current = 1; current <= totalPages; current++) {
    const nearCurrent = Math.abs(current - page) <= PAGE_WINDOW;
    if (current === 1 || current === totalPages || nearCurrent) {
      numbers.push(current);
    } else if (numbers.at(-1) !== null) {
      numbers.push(null);
    }
  }

  return numbers;
};

/** A stable key per entry: a page number, or the gap after one. */
const pageNumberKey = (numbers: (null | number)[], position: number) =>
  numbers[position] === null
    ? `gap-after-${numbers[position - 1]}`
    : `page-${numbers[position]}`;

/**
 * Page links for a list page.
 *
 * Plain links rather than buttons, so crawlers and readers without JavaScript
 * reach every page. Renders nothing when everything fits on one page.
 */
export const ContentListPagination = ({
  className,
  page,
  search,
  totalPages,
}: {
  className?: string;
  page: number;
  search: ContentListSearch;
  totalPages: number;
}) => {
  const t = useTranslations("core.global");

  if (totalPages <= 1) return null;

  const numbers = contentListPageNumbers(page, totalPages);
  const pageLink = (target: number) =>
    nextContentListSearch(search, { page: target });

  return (
    <Pagination className={className}>
      <PaginationContent className="flex-wrap justify-center">
        {page > 1 ? (
          <PaginationItem>
            <Link
              activeOptions={EXACT_MATCH}
              aria-label={t("previous_page")}
              className={buttonVariants({ variant: "ghost" })}
              rel="prev"
              search={pageLink(page - 1)}
              to="."
            >
              <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
              <span className="hidden sm:block">{t("previous")}</span>
            </Link>
          </PaginationItem>
        ) : null}

        {numbers.map((number, position) =>
          number === null ? (
            <PaginationItem key={pageNumberKey(numbers, position)}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={pageNumberKey(numbers, position)}>
              <Link
                activeOptions={EXACT_MATCH}
                aria-current={number === page ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    size: "icon",
                    variant: number === page ? "outline" : "ghost",
                  }),
                  "w-auto min-w-9 px-2 tabular-nums",
                )}
                search={pageLink(number)}
                to="."
              >
                {number}
              </Link>
            </PaginationItem>
          ),
        )}

        {page < totalPages ? (
          <PaginationItem>
            <Link
              activeOptions={EXACT_MATCH}
              aria-label={t("next_page")}
              className={buttonVariants({ variant: "ghost" })}
              rel="next"
              search={pageLink(page + 1)}
              to="."
            >
              <span className="hidden sm:block">{t("next")}</span>
              <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
            </Link>
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  );
};

/**
 * The search box of a list page.
 *
 * A real `GET` form: without JavaScript it reloads the page with `?q=`, and
 * with it the router navigates without a reload. Active filters travel along
 * as hidden fields, and a new term goes back to the first page.
 */
export const ContentListSearchForm = ({
  className,
  label,
  placeholder,
  search,
}: {
  className?: string;
  /** The accessible name of the field. Defaults to "Search". */
  label?: string;
  placeholder?: string;
  search: ContentListSearch;
}) => {
  const t = useTranslations("core.global");
  const navigate = useNavigate();
  const id = React.useId();
  const kept = Object.entries(search).filter(
    ([key, value]) => key !== "page" && key !== "q" && value !== undefined,
  );

  return (
    <form
      className={cn("flex items-center gap-2", className)}
      data-slot="content-list-search"
      method="get"
      onSubmit={event => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get("q");

        void navigate({
          search: nextContentListSearch(search, {
            q: typeof q === "string" && q.trim() !== "" ? q.trim() : undefined,
          }),
          to: ".",
        });
      }}
      role="search"
    >
      <label className="sr-only" htmlFor={id}>
        {label ?? t("search")}
      </label>
      <InputGroup className="flex-1">
        <InputGroupInput
          defaultValue={search.q ?? ""}
          id={id}
          key={search.q ?? ""}
          name="q"
          placeholder={placeholder ?? t("search_placeholder")}
          type="search"
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>

      {kept.map(([key, value]) => (
        <input key={key} name={key} type="hidden" value={String(value)} />
      ))}

      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
};

export interface ContentListFilterOption {
  label: string;
  value: ContentListFilterValue;
}

/**
 * One filter of a list page: its name above a row of links.
 *
 * The first link clears the filter. The active option carries
 * `aria-current="page"`, and choosing another goes back to the first page.
 */
export const ContentListFilter = ({
  allLabel,
  className,
  label,
  name,
  options,
  search,
}: {
  /** The text of the link that clears the filter. Defaults to "All". */
  allLabel?: string;
  className?: string;
  /** The visible name of the filter, such as "Difficulty". */
  label: string;
  /** The filter's field name, as listed in `delivery.list.filters`. */
  name: string;
  options: readonly ContentListFilterOption[];
  search: ContentListSearch;
}) => {
  const t = useTranslations("core.global");
  const labelId = React.useId();
  const active = search[name];
  const chip = (isActive: boolean) =>
    buttonVariants({ size: "sm", variant: isActive ? "default" : "outline" });

  return (
    <nav
      aria-labelledby={labelId}
      className={cn("flex flex-col gap-2", className)}
      data-slot="content-filter"
    >
      <span className="text-muted-foreground text-sm font-medium" id={labelId}>
        {label}
      </span>
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            activeOptions={EXACT_MATCH}
            aria-current={active === undefined ? "page" : undefined}
            className={chip(active === undefined)}
            search={nextContentListSearch(search, { [name]: undefined })}
            to="."
          >
            {allLabel ?? t("all")}
          </Link>
        </li>
        {options.map(option => (
          <li key={String(option.value)}>
            <Link
              activeOptions={EXACT_MATCH}
              aria-current={active === option.value ? "page" : undefined}
              className={chip(active === option.value)}
              search={nextContentListSearch(search, {
                [name]: option.value,
              })}
              to="."
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
