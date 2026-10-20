import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { cn } from "cn";

const pendingRowKeys = (rows: number): number[] =>
  Array.from({ length: rows }, (_, index) => index);

const CardRowSkeleton = () => (
  <div className="bg-card grid grid-cols-1 gap-4 rounded-2xl p-2 shadow-xs ring-1 ring-black/5 sm:grid-cols-[16rem_1fr] sm:gap-6 md:grid-cols-[18rem_1fr] dark:ring-white/10">
    <Skeleton className="aspect-video w-full rounded-lg" />
    <div className="flex flex-col gap-3 px-2 pb-2 sm:py-3 sm:pe-4">
      <div className="flex gap-1.5">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>
      <Skeleton className="h-6 w-4/5" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  </div>
);

const TileSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn("aspect-video w-full rounded-xl", className)} />
);

const SidebarSkeleton = () => (
  <div className="hidden flex-col gap-3 lg:flex">
    <Skeleton className="h-5 w-24" />
    <div className="flex flex-col gap-1">
      {pendingRowKeys(6).map(key => (
        <div className="flex min-h-11 items-center gap-3 px-3" key={key}>
          <Skeleton className="size-3 shrink-0 rounded-xs" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

const BlogSkeleton = ({ isCategory }: { isCategory: boolean }) => (
  <div
    aria-busy="true"
    className="container mx-auto flex max-w-7xl flex-col px-4 py-8 md:py-12"
    data-slot="route-pending"
  >
    <span className="sr-only" role="status">
      Loading
    </span>
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 md:gap-4">
          {isCategory ? (
            <Skeleton className="size-6 shrink-0 rounded-md md:size-9 md:rounded-lg" />
          ) : null}
          <Skeleton className="h-9 w-40 md:h-12 md:w-56" />
        </div>
        <Skeleton className="h-5 w-72 max-w-full md:h-6 md:w-md" />
      </div>

      {isCategory ? null : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
            <TileSkeleton className="lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full" />
            <TileSkeleton />
            <TileSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TileSkeleton />
            <TileSkeleton />
            <TileSkeleton />
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-hidden lg:hidden">
        {pendingRowKeys(4).map(key => (
          <Skeleton className="h-9 w-24 shrink-0 rounded-md" key={key} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_17rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <div className="flex flex-col gap-5">
            {pendingRowKeys(isCategory ? 4 : 3).map(key => (
              <CardRowSkeleton key={key} />
            ))}
          </div>
        </div>
        <SidebarSkeleton />
      </div>
    </div>
  </div>
);

export const BlogPendingSkeleton = () => <BlogSkeleton isCategory={false} />;

export const BlogCategoryPendingSkeleton = () => <BlogSkeleton isCategory />;
