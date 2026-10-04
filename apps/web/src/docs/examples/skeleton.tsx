import { Skeleton } from '@vitnode/core/components/ui/skeleton'

export default function SkeletonDemo() {
  return (
    <div className="not-prose flex w-full max-w-sm items-center gap-4">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}
