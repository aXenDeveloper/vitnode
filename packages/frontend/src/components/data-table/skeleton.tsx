import { Skeleton } from '../ui/skeleton';

export const SkeletonDataTable = () => {
  return (
    <>
      <div className="flex h-12 gap-5 border-b p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>

      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </>
  );
};
