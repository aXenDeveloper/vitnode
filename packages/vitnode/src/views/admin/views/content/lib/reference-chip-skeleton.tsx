import { Skeleton } from "@/components/ui/skeleton";

export const ContentReferenceChipSkeleton = ({
  avatar = false,
}: {
  avatar?: boolean;
}) => (
  <span aria-hidden className="flex items-center gap-2">
    {avatar ? (
      <Skeleton className="bg-muted-foreground/25 size-4 shrink-0 rounded-full" />
    ) : null}
    <Skeleton className="bg-muted-foreground/25 h-3 w-16 rounded-sm" />
  </span>
);
