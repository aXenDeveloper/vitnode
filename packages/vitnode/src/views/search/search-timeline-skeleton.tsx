import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

const CARD =
  "bg-card ring-foreground/8 flex flex-col gap-2 rounded-xl p-4 ring-1";

const DAYS = [
  { id: "today", items: ["banner", "comment"] },
  { id: "earlier", items: ["comment", "topic"] },
] as const;

type SkeletonCard = (typeof DAYS)[number]["items"][number];

const CardSkeleton = ({ kind }: { kind: SkeletonCard }) => (
  <div className={cn(CARD, kind === "banner" && "overflow-hidden p-0")}>
    {kind === "banner" && (
      <Skeleton className="h-32 w-full rounded-none sm:h-44" />
    )}
    <div
      className={cn("flex flex-col gap-2", kind === "banner" && "p-4 sm:p-5")}
    >
      <Skeleton className="h-3 w-28" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
      {kind === "comment" ? (
        <div className="border-border flex flex-col gap-2 border-s-2 ps-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ) : (
        <>
          <Skeleton
            className={cn("h-5", kind === "banner" ? "w-4/5" : "w-3/5")}
          />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </>
      )}
    </div>
  </div>
);

export const SearchTimelineSkeleton = ({
  className,
}: {
  className?: string;
}) => (
  <div aria-hidden="true" className={cn("flex flex-col gap-4", className)}>
    <Skeleton className="h-6 w-36" />
    <ol className="flex flex-col">
      {DAYS.map((day, dayIndex) => (
        <li className="flex flex-col" key={day.id}>
          <div className="flex gap-3 sm:gap-4">
            <div className="flex w-12 shrink-0 flex-col items-center">
              {dayIndex > 0 && <span className="bg-border h-4 w-px" />}
              <Skeleton className="h-14 w-12 rounded-xl" />
            </div>
            <div className={cn("flex items-center", dayIndex > 0 && "pt-4")}>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <ol className="flex flex-col">
            {day.items.map((kind, itemIndex) => {
              const isLast =
                dayIndex === DAYS.length - 1 &&
                itemIndex === day.items.length - 1;

              return (
                <li className="flex gap-3 sm:gap-4" key={`${day.id}-${kind}`}>
                  <div className="flex w-12 shrink-0 flex-col items-center">
                    <span className="bg-border h-4 w-px" />
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    {!isLast && <span className="bg-border w-px grow" />}
                  </div>
                  <div className="min-w-0 flex-1 pt-4">
                    <CardSkeleton kind={kind} />
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  </div>
);
