// Prototype - riff 2: Sheet. Close to the reference screenshot, sections split by full-bleed rules.
import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import { cn } from 'cn'
import { ArrowRightIcon } from 'lucide-react'

import type { Variant } from './shared'

import {
  AmbientHeader,
  AmbientHeaderSkeleton,
  GroupRow,
  LastVisited,
  useElapsed,
} from './ambient-header'
import { ProfileError, SignedReputation, useCard } from './shared'

const Stat = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <div className="flex min-w-0 flex-col items-center gap-0.5 py-3">
    <dd className="text-foreground text-base font-semibold tabular-nums">
      {children}
    </dd>
    <dt className="text-muted-foreground text-sm">{label}</dt>
  </div>
)

const SheetSkeleton = () => (
  <div aria-busy="true" className="flex flex-col">
    <AmbientHeaderSkeleton />
    <div className="flex justify-between border-t px-4 py-3">
      <Skeleton className="h-10 w-16" />
      <Skeleton className="h-10 w-20" />
    </div>
    <Skeleton className="mx-4 my-3 h-12" />
    <div className="flex items-center gap-3 border-t px-4 py-3">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <div className="flex gap-2 border-t p-4">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-8 flex-1" />
    </div>
  </div>
)

const Body = ({ nameCode }: { nameCode: string }) => {
  const { presence, query } = useCard(nameCode)
  const elapsed = useElapsed()

  if (query.isPending) return <SheetSkeleton />
  if (query.isError) return <ProfileError query={query} />

  const user = query.data
  const href = userProfileHref(user.nameCode)

  return (
    <div className="flex flex-col">
      <AmbientHeader presence={presence} user={user} />

      <dl className="flex items-start justify-between gap-4 border-t px-4 py-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="text-foreground font-medium">
            {elapsed(user.createdAt)}
          </dd>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-end">
          <dt className="text-muted-foreground">Last visited</dt>
          <dd className="text-foreground font-medium">
            <LastVisited presence={presence} />
          </dd>
        </div>
      </dl>

      <dl className="grid grid-cols-3 divide-x border-t">
        <Stat label="Reputation">
          <SignedReputation value={user.reputation ?? 0} />
        </Stat>
        <Stat label="Roles">{1 + user.secondaryRoles.length}</Stat>
        <Stat label="Member">#{user.id}</Stat>
      </dl>

      <div className="border-t px-4 py-3">
        <GroupRow user={user} />
      </div>

      <div className="flex gap-2 border-t p-4">
        <CopyButton
          content={() => new URL(href, window.location.origin).toString()}
          size="sm"
        >
          Copy link
        </CopyButton>
        <Link
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
          to={href}
        >
          View profile
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export const sheet: Variant = {
  name: 'Sheet',
  contentClassName: 'w-80 overflow-hidden p-0',
  Content: Body,
}
