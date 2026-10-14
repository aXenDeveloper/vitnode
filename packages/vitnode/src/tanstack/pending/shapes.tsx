import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { SearchTimelineSkeleton } from "@/views/search/search-timeline-skeleton";

import type { RoutePendingSkeletonProps } from "./route-pending-skeleton";

import {
  PendingFrame,
  PendingHeading,
  pendingRowKeys,
} from "./route-pending-skeleton";

export const FeedPendingSkeleton = ({
  className,
  label,
  rows = 3,
  withDescription = true,
}: RoutePendingSkeletonProps) => (
  <PendingFrame
    className={cn("container mx-auto max-w-3xl", className)}
    label={label}
  >
    <PendingHeading withDescription={withDescription} />

    <div aria-hidden="true" className="flex flex-col gap-4">
      {pendingRowKeys(rows).map(key => (
        <div className="flex flex-col gap-4 rounded-lg border p-4" key={key}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="hidden h-3 w-2/3 sm:block" />
          </div>
        </div>
      ))}
    </div>
  </PendingFrame>
);

export const DiscoverPendingSkeleton = ({
  className,
  label,
}: Pick<RoutePendingSkeletonProps, "className" | "label">) => (
  <PendingFrame
    className={cn("container mx-auto max-w-3xl", className)}
    label={label}
  >
    <PendingHeading />
    <SearchTimelineSkeleton />
  </PendingFrame>
);

const SEARCH_FILTER_GROUPS = [
  { id: "content", rows: 3 },
  { id: "date", rows: 6 },
] as const;

export const SearchPendingSkeleton = ({
  className,
  label,
}: Pick<RoutePendingSkeletonProps, "className" | "label">) => (
  <PendingFrame
    className={cn("container mx-auto max-w-6xl", className)}
    label={label}
  >
    <PendingHeading />
    <div aria-hidden="true" className="flex flex-col gap-8">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid gap-10 lg:grid-cols-4">
        <div className="flex flex-col gap-6 p-1 max-lg:hidden">
          {SEARCH_FILTER_GROUPS.map(group => (
            <div className="flex flex-col gap-3 px-2" key={group.id}>
              <Skeleton className="h-4 w-24" />
              {pendingRowKeys(group.rows).map(key => (
                <div className="flex items-center gap-2.5" key={key}>
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-3 px-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <Skeleton className="h-9 w-28 rounded-md lg:hidden" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ms-auto h-8 w-36 rounded-md" />
          </div>
          <SearchTimelineSkeleton />
        </div>
      </div>
    </div>
  </PendingFrame>
);

export const TablePendingSkeleton = ({
  className,
  label,
  rows = 6,
  withDescription = true,
}: RoutePendingSkeletonProps) => (
  <PendingFrame className={className} label={label}>
    <PendingHeading withDescription={withDescription} />

    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="ml-auto h-9 w-32" />
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border">
        <div className="bg-muted/50 flex items-center gap-4 border-b p-4">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="hidden h-3 w-1/6 sm:block" />
          <Skeleton className="hidden h-3 w-1/6 md:block" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>

        {pendingRowKeys(rows).map(key => (
          <div
            className="flex items-center gap-4 border-b p-4 last:border-b-0"
            key={key}
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="hidden h-3 w-1/6 sm:block" />
            <Skeleton className="hidden h-3 w-1/6 md:block" />
            <Skeleton className="ml-auto h-8 w-8" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  </PendingFrame>
);

export const FormPendingSkeleton = ({
  className,
  label,
  rows = 4,
  withDescription = true,
}: RoutePendingSkeletonProps) => (
  <PendingFrame className={className} label={label}>
    <PendingHeading withDescription={withDescription} />

    <div
      aria-hidden="true"
      className="flex flex-col gap-6 rounded-lg border p-4"
    >
      {pendingRowKeys(rows).map(key => (
        <div className="flex flex-col gap-2" key={key}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}

      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  </PendingFrame>
);

export const CardsPendingSkeleton = ({
  className,
  label,
  rows = 6,
  withDescription = true,
}: RoutePendingSkeletonProps) => (
  <PendingFrame className={className} label={label}>
    <PendingHeading withDescription={withDescription} />

    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {pendingRowKeys(rows).map(key => (
        <div className="flex flex-col gap-4 rounded-lg border p-4" key={key}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  </PendingFrame>
);

export const AuthPendingSkeleton = ({
  className,
  label,
  rows = 2,
}: RoutePendingSkeletonProps) => (
  <PendingFrame
    className={cn("items-center justify-center gap-0 py-16", className)}
    label={label}
  >
    <div
      aria-hidden="true"
      className="flex w-full max-w-sm flex-col gap-6 rounded-lg border p-6"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      {pendingRowKeys(rows).map(key => (
        <div className="flex flex-col gap-2" key={key}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}

      <Skeleton className="h-9 w-full" />
    </div>
  </PendingFrame>
);

export const BreadcrumbPendingSkeleton = ({
  className,
  label = "Loading",
}: Pick<RoutePendingSkeletonProps, "className" | "label">) => (
  <div
    aria-busy="true"
    className={cn("flex items-center gap-2", className)}
    data-slot="breadcrumb-pending"
  >
    <span className="sr-only" role="status">
      {label}
    </span>

    <Skeleton aria-hidden="true" className="h-3 w-16" />
    <span aria-hidden="true" className="text-muted-foreground/40 text-xs">
      /
    </span>
    <Skeleton aria-hidden="true" className="h-3 w-24" />
  </div>
);

export const ProfilePendingSkeleton = ({
  className,
  label,
}: Pick<RoutePendingSkeletonProps, "className" | "label">) => (
  <PendingFrame className={cn("container mx-auto", className)} label={label}>
    <div aria-hidden="true" className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col overflow-hidden rounded-xl border">
        <Skeleton className="h-32 w-full rounded-none sm:h-40 md:h-48" />

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-6">
            <Skeleton className="border-background -mt-16 size-24 shrink-0 rounded-full border-4 sm:-mt-20 sm:size-32" />
            <div className="flex flex-col items-center gap-2 sm:items-start sm:pb-2">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex items-center justify-center sm:justify-start">
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 rounded-xl border p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-5 w-20" />
          </div>

          {pendingRowKeys(2).map(key => (
            <div className="flex flex-col gap-2" key={key}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-24" />
        <SearchTimelineSkeleton />
      </div>
    </div>
  </PendingFrame>
);
