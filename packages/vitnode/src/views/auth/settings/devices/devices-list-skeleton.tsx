import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const DETAIL_IDS = Array.from({ length: 3 }, (_, i) => `s-detail-${i}`);

export const DevicesListSkeleton = () => (
  <div aria-hidden className="rounded-lg border p-4 sm:p-6">
    <div className="flex items-start gap-4">
      <Skeleton className="size-10 shrink-0 rounded-md" />

      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-32" />
      </div>
    </div>

    <Separator className="my-4" />

    <div className="grid gap-2">
      {DETAIL_IDS.map(id => (
        <div className="grid gap-1 sm:grid-cols-[10rem_1fr]" key={id}>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
      ))}
    </div>
  </div>
);
