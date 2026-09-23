import { Skeleton } from "@/components/ui/skeleton";

const ROW_IDS = Array.from({ length: 3 }, (_, i) => `s-device-${i}`);
const FACT_IDS = Array.from({ length: 3 }, (_, i) => `s-fact-${i}`);

export const DevicesListSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2">
    <Skeleton className="ms-4 h-5 w-28" />
    <div className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl shadow-xs ring-1">
      {ROW_IDS.map(id => (
        <div className="flex items-start gap-3 px-4 py-3" key={id}>
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <div className="flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:gap-x-6">
              {FACT_IDS.map(fact => (
                <div className="flex gap-3 sm:flex-col sm:gap-0.5" key={fact}>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
