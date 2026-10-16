import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

import {
  PendingFrame,
  PendingHeading,
  pendingRowKeys,
} from "../../pending/route-pending-skeleton";

const SectionHeadingPending = () => (
  <div aria-hidden="true" className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
    <Skeleton className="h-8 w-32 rounded-md" />
  </div>
);

const FramePending = ({ rows = 4 }: { rows?: number }) => (
  <div
    aria-hidden="true"
    className="bg-muted/50 ring-foreground/10 flex flex-col rounded-lg p-1 ring-1"
  >
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-3.5 w-36" />
      </div>
      <Skeleton className="h-8 w-28 rounded-md" />
    </div>
    <div className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-md ring-1">
      {pendingRowKeys(rows).map(key => (
        <div
          className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
          key={key}
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="ms-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  </div>
);

const TablePending = ({ rows = 6 }: { rows?: number }) => (
  <div
    aria-hidden="true"
    className="flex flex-col overflow-hidden rounded-lg border"
  >
    <div className="bg-muted/50 flex items-center gap-4 border-b p-4">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="hidden h-3 w-1/6 sm:block" />
      <Skeleton className="ms-auto h-3 w-1/5" />
    </div>
    {pendingRowKeys(rows).map(key => (
      <div
        className="flex items-center gap-4 border-b p-4 last:border-b-0"
        key={key}
      >
        <div className="flex w-1/3 flex-col gap-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="hidden h-3.5 w-1/6 sm:block" />
        <Skeleton className="ms-auto h-3.5 w-1/5" />
      </div>
    ))}
  </div>
);

export const DebugFramePending = () => (
  <PendingFrame className="p-0">
    <FramePending />
  </PendingFrame>
);

export const DebugOverviewPending = () => (
  <PendingFrame className="p-0">
    <FramePending rows={3} />
    <FramePending rows={6} />
  </PendingFrame>
);

export const DebugTablePending = () => (
  <PendingFrame className="p-0">
    <SectionHeadingPending />
    <TablePending />
  </PendingFrame>
);

const NavPending = () => (
  <div aria-hidden="true" className="flex flex-col gap-6 max-md:hidden">
    <Skeleton className="h-9 w-full rounded-lg" />
    {[5, 3].map(count => (
      <div className="flex flex-col gap-2" key={count}>
        <Skeleton className="mx-2.5 h-3 w-20" />
        {pendingRowKeys(count).map(key => (
          <div className="flex items-center gap-3 px-2.5 py-2" key={key}>
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className={cn("h-3.5", key % 2 ? "w-24" : "w-32")} />
          </div>
        ))}
      </div>
    ))}
  </div>
);

export const DebugLayoutPending = () => (
  <PendingFrame className="sm:p-6">
    <PendingHeading />
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
      <NavPending />
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
        <FramePending rows={3} />
        <FramePending rows={6} />
      </div>
    </div>
  </PendingFrame>
);
