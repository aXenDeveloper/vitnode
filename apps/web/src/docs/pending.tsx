import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { cn } from '@vitnode/core/lib/utils'
import { DocsPage } from 'fumadocs-ui/page'

const DocsHeadingPendingSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-24" />
    </div>

    <div className="flex flex-wrap items-center justify-between gap-4">
      <Skeleton className="h-9 w-3/5 max-w-xs sm:h-10" />
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>

    <Skeleton className="h-5 w-4/5 max-w-md" />
  </div>
)

const DocsProsePendingSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-8">
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-11/12" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>

    <Skeleton className="h-40 w-full rounded-xl" />

    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-10/12" />
    </div>

    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-9/12" />
      <Skeleton className="h-3.5 w-2/3 max-sm:hidden" />
    </div>
  </div>
)

const DocsPendingStatus = () => (
  <span className="sr-only" role="status">
    Loading documentation
  </span>
)

export const DocsPagePendingSkeleton = () => (
  <DocsPage
    aria-busy="true"
    breadcrumb={{ enabled: false }}
    data-slot="route-pending"
    footer={{ enabled: false }}
    tableOfContentPopover={{ enabled: true }}
    toc={[]}
  >
    <DocsPendingStatus />
    <DocsHeadingPendingSkeleton />
    <DocsProsePendingSkeleton />
  </DocsPage>
)

const SIDEBAR_LINK_WIDTHS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2']

const DocsSidebarGroupPendingSkeleton = ({ links }: { links: number }) => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-3 w-24" />

    {SIDEBAR_LINK_WIDTHS.slice(0, links).map((width) => (
      <Skeleton className={cn('h-3.5', width)} key={width} />
    ))}
  </div>
)

export const DocsShellPendingSkeleton = () => (
  <div
    aria-busy="true"
    className="flex min-h-dvh flex-col"
    data-slot="route-pending"
  >
    <DocsPendingStatus />

    <header
      aria-hidden="true"
      className="flex h-14 shrink-0 items-center gap-4 border-b px-4 md:px-6"
    >
      <Skeleton className="h-6 w-30" />
      <Skeleton className="h-8 w-full max-w-sm rounded-xl max-md:hidden" />

      <div className="ms-auto flex items-center gap-3">
        <Skeleton className="h-4 w-24 max-lg:hidden" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </header>

    <div className="flex flex-1">
      <aside
        aria-hidden="true"
        className="bg-card flex w-67 shrink-0 flex-col gap-6 border-e p-4 max-md:hidden"
      >
        <Skeleton className="h-11 w-full rounded-lg" />

        <DocsSidebarGroupPendingSkeleton links={4} />
        <DocsSidebarGroupPendingSkeleton links={3} />
        <DocsSidebarGroupPendingSkeleton links={2} />
      </aside>

      <div className="mx-auto flex w-full max-w-225 flex-col gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14">
        <DocsHeadingPendingSkeleton />
        <DocsProsePendingSkeleton />
      </div>
    </div>
  </div>
)
