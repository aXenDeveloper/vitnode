import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["first", "second", "third", "fourth"];

/**
 * Shaped like the entries of an activity history while they load. Takes its
 * `label` so it can render before the Activity Logs messages arrive.
 */
export const ActivityHistoryPending = ({ label }: { label: string }) => (
  <div aria-busy className="flex flex-col gap-5">
    <span className="sr-only" role="status">
      {label}
    </span>
    {ROWS.map(row => (
      <div className="flex gap-3" key={row}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    ))}
  </div>
);
