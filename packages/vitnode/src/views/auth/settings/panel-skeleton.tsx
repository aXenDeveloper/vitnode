import { Skeleton } from "@/components/ui/skeleton";

export const SettingsPanelSkeleton = () => (
  <div aria-hidden className="mb-6 flex min-h-9 flex-col gap-2">
    <Skeleton className="h-7 w-48 sm:h-8" />
    <Skeleton className="h-5 w-64" />
  </div>
);
