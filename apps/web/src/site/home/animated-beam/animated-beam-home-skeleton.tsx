import { Skeleton } from '@vitnode/core/components/ui/skeleton'

const Row = ({ center }: { center?: boolean }) => (
  <div className="flex flex-row items-center justify-between">
    <Skeleton className="size-12" />
    <Skeleton className={center ? 'size-16' : 'size-12'} />
    <Skeleton className="size-12" />
  </div>
)

/**
 * What the hero shows while the beam's chunk is on the wire.
 *
 * The same three rows at the same sizes, so the hero does not resize when the
 * real thing arrives. It is the Suspense fallback for a `React.lazy` boundary
 * now rather than for an eagerly imported component, which is what makes it a
 * boundary that actually defers something - see `home-content.tsx`.
 */
export const AnimatedBeamHomeSkeleton = () => (
  <div
    aria-busy="true"
    className="relative flex w-full items-center justify-center overflow-hidden p-4 sm:max-w-md"
  >
    <div className="flex size-full max-w-lg flex-col items-stretch justify-between gap-10">
      <Row />
      <Row center />
      <Row />
    </div>

    <span className="sr-only">Loading</span>
  </div>
)
