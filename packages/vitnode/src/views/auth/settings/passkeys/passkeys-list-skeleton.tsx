import { Skeleton } from "@/components/ui/skeleton";

const ROW_IDS = Array.from({ length: 2 }, (_, i) => `s-passkey-${i}`);

export const PasskeysListSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-2">
    <div className="flex flex-col gap-1">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-5 w-full max-w-md" />
    </div>
    <div className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-md shadow-xs ring-1">
      {ROW_IDS.map(id => (
        <div className="flex items-start gap-3 px-4 py-3" key={id}>
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
