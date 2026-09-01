"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
