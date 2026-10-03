import type { VariantProps } from "class-variance-authority";

import { cn } from "cn";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
      role="navigation"
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex items-center gap-1", className)}
      data-slot="pagination-content"
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = Pick<VariantProps<typeof buttonVariants>, "size"> &
  React.ComponentProps<"a"> & {
    isActive?: boolean;
  };

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ size, variant: isActive ? "outline" : "ghost" }),
        className,
      )}
      data-active={isActive}
      data-slot="pagination-link"
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations("core.global");

  return (
    <PaginationLink
      aria-label={t("previous_page")}
      className={cn("ps-2!", className)}
      size="default"
      {...props}
    >
      <ChevronLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      <span className="hidden sm:block">{text ?? t("previous")}</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  text,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  const t = useTranslations("core.global");

  return (
    <PaginationLink
      aria-label={t("next_page")}
      className={cn("pe-2!", className)}
      size="default"
      {...props}
    >
      <span className="hidden sm:block">{text ?? t("next")}</span>
      <ChevronRightIcon className="rtl:rotate-180" data-icon="inline-end" />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="pagination-ellipsis"
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
