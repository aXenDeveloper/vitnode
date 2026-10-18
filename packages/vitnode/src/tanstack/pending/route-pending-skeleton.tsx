import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/** Props shared by the route pending skeletons. */
export interface RoutePendingSkeletonProps {
  className?: string;
  /** Screen-reader status text. Defaults to `Loading`; pass a translated string when you have one. */
  label?: string;
  /** How many placeholder rows, cards or fields to draw. Each skeleton has its own default. */
  rows?: number;
  /** Draws a description line under the heading placeholder. Defaults to `true`. */
  withDescription?: boolean;
}

export const PendingFrame = ({
  children,
  className,
  label = "Loading",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) => (
  <div
    aria-busy="true"
    className={cn("flex w-full flex-col gap-6 p-4", className)}
    data-slot="route-pending"
  >
    <span className="sr-only" role="status">
      {label}
    </span>

    {children}
  </div>
);

export const PendingHeading = ({
  withDescription = true,
}: {
  withDescription?: boolean;
}) => (
  <div aria-hidden="true" className="flex flex-col gap-3">
    <Skeleton className="h-8 w-3/5 max-w-xs" />
    {withDescription ? <Skeleton className="h-4 w-4/5 max-w-md" /> : null}
  </div>
);

export const pendingRowKeys = (rows: number): number[] =>
  Array.from({ length: Math.max(rows, 0) }, (_, index) => index);

/**
 * A generic page placeholder - heading plus text blocks - announced to screen
 * readers as busy. Use it as a route's `pendingComponent` (a plugin page's
 * `pendingComponent`, or the router's default); pick the closer shape when one
 * exists: `FeedPendingSkeleton`, `CardsPendingSkeleton`, `FormPendingSkeleton`,
 * `TablePendingSkeleton`.
 */
export const RoutePendingSkeleton = ({
  className,
  label,
  rows = 3,
  withDescription = true,
}: RoutePendingSkeletonProps) => (
  <PendingFrame className={cn("container mx-auto", className)} label={label}>
    <PendingHeading withDescription={withDescription} />

    <div aria-hidden="true" className="flex flex-col gap-6">
      {pendingRowKeys(rows).map(key => (
        <div className="flex flex-col gap-3" key={key}>
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="hidden h-3 w-3/4 sm:block" />
        </div>
      ))}
    </div>
  </PendingFrame>
);

/** A centered spinner, for pending states with no predictable layout - e.g. the router's `defaultPendingComponent`. */
export const RoutePendingSpinner = ({
  className,
  label = "Loading",
}: Pick<RoutePendingSkeletonProps, "className" | "label">) => (
  <div
    aria-busy="true"
    className={cn(
      "text-muted-foreground flex w-full items-center justify-center p-16",
      className,
    )}
    data-slot="route-pending"
  >
    <Spinner aria-label={label} className="size-8" />
  </div>
);
