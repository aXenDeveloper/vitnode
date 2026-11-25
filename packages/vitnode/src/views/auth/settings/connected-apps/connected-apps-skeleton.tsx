import { Skeleton } from "@/components/ui/skeleton";

const ROW_IDS = Array.from({ length: 2 }, (_, i) => `s-app-${i}`);
const FACT_IDS = Array.from({ length: 3 }, (_, i) => `s-app-fact-${i}`);

export const ConnectedAppsSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2">
    <div className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-md shadow-xs ring-1">
      {ROW_IDS.map(id => (
        <div className="flex items-start gap-3 px-4 py-3" key={id}>
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40 max-w-full" />
            <div className="flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:gap-x-6">
              {FACT_IDS.map(fact => (
                <div className="flex gap-3 sm:flex-col sm:gap-0.5" key={fact}>
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-8 w-28 shrink-0" />
        </div>
      ))}
    </div>
  </div>
);
